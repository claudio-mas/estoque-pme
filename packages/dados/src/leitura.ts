/**
 * Ler o que foi apurado, pelo mesmo codec que gravou.
 *
 * A leitura mora aqui pela mesma razão da escrita: o app não deve tocar em
 * `estoque_estado` cru. A primeira tela que ler a coluna direto é a primeira
 * que confunde `ausente` com `indefinido` — e o codec é exatamente o que torna
 * isso impossível.
 *
 * O que sai é `Lancamento`, não indicador. PME, cobertura e perda são do motor,
 * que roda no app — no servidor ou no navegador, tanto faz (D11). Servir o
 * derivado daqui faria este pacote dono de resultado, que o ADR-0009 disse que
 * não se persiste e, por extensão, não se serve de cá.
 */
import { and, asc, eq } from 'drizzle-orm';
import type { Lancamento, Nivel } from '@estoque-pme/motor-calculo';
import type { Transacao } from './banco';
import { consumoDeLinha, custoMateriaisDeLinha, perdaDeLinha, saldoDeLinha } from './codec';
import { lancamentoNivel, periodo } from './schema';

const NIVEIS: readonly Nivel[] = ['MP', 'PP', 'PA'];

/** Um período como a tela o vê: apurado com lançamento, ou só importado. */
export type PeriodoLido =
  | { readonly estado: 'apurado'; readonly lancamento: Lancamento }
  | { readonly estado: 'importado'; readonly competencia: { ano: number; mes: number } };

/** Os períodos da empresa, do mais antigo ao mais recente. */
export async function lancamentosDaEmpresa(
  tx: Transacao,
  empresaId: string,
): Promise<readonly PeriodoLido[]> {
  const periodos = await tx
    .select()
    .from(periodo)
    .where(eq(periodo.empresaId, empresaId))
    .orderBy(asc(periodo.ano), asc(periodo.mes));

  const resultado: PeriodoLido[] = [];

  for (const p of periodos) {
    const competencia = { ano: p.ano, mes: p.mes };
    if (p.estado !== 'apurado') {
      resultado.push({ estado: 'importado', competencia });
      continue;
    }

    const niveis = await tx
      .select()
      .from(lancamentoNivel)
      .where(
        and(
          eq(lancamentoNivel.empresaId, empresaId),
          eq(lancamentoNivel.ano, p.ano),
          eq(lancamentoNivel.mes, p.mes),
        ),
      );

    const porNivel = (nivel: Nivel) => {
      const linha = niveis.find((n) => n.nivel === nivel);
      if (linha === undefined) {
        throw new Error(`Período apurado sem linha de ${nivel}: ${p.ano}/${p.mes}.`);
      }
      return linha;
    };

    const estoque = {} as Record<Nivel, Lancamento['estoque'][Nivel]>;
    const consumo = {} as Record<Nivel, Lancamento['consumo'][Nivel]>;
    const perdas = {} as Record<Nivel, bigint | null>;

    for (const nivel of NIVEIS) {
      const l = porNivel(nivel);
      estoque[nivel] = saldoDeLinha({
        estado: l.estoqueEstado,
        abertura: l.estoqueAbertura,
        fechamento: l.estoqueFechamento,
        motivo: {
          codigo: l.estoqueMotivoCodigo,
          tipo: l.estoqueMotivoAncoraTipo,
          linha: l.estoqueMotivoAncoraLinha,
          coluna: l.estoqueMotivoAncoraColuna,
          conta: l.estoqueMotivoAncoraConta,
          nivel: l.estoqueMotivoAncoraNivel,
        },
      });
      consumo[nivel] = consumoDeLinha({
        estado: l.consumoEstado,
        valor: l.consumoValor,
        motivo: {
          codigo: l.consumoMotivoCodigo,
          tipo: l.consumoMotivoAncoraTipo,
          linha: l.consumoMotivoAncoraLinha,
          coluna: l.consumoMotivoAncoraColuna,
          conta: l.consumoMotivoAncoraConta,
          nivel: l.consumoMotivoAncoraNivel,
        },
      });
      perdas[nivel] = perdaDeLinha({ estado: l.perdasEstado, valor: l.perdasValor });
    }

    if (p.cmv === null) {
      throw new Error(`Período apurado sem CMV: ${p.ano}/${p.mes}. O CHECK deveria ter recusado.`);
    }

    resultado.push({
      estado: 'apurado',
      lancamento: {
        competencia,
        estoque,
        consumo,
        perdas,
        cmv: p.cmv,
        receita: p.receita,
        compras: p.compras,
        custoMateriais: custoMateriaisDeLinha({
          origem: p.custoMateriaisOrigem,
          valor: p.custoMateriaisValor,
          informado: p.custoMateriaisInformado,
          motivo: {
            codigo: p.custoMateriaisMotivoCodigo,
            tipo: p.custoMateriaisMotivoAncoraTipo,
            linha: p.custoMateriaisMotivoAncoraLinha,
            coluna: p.custoMateriaisMotivoAncoraColuna,
            conta: p.custoMateriaisMotivoAncoraConta,
            nivel: p.custoMateriaisMotivoAncoraNivel,
          },
        }),
      },
    });
  }

  return resultado;
}
