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
import { and, asc, desc, eq } from 'drizzle-orm';
import type { LinhaBalancete } from '@estoque-pme/importador';
import type { Lancamento, Nivel } from '@estoque-pme/motor-calculo';
import type { Transacao } from './banco';
import { consumoDeLinha, custoMateriaisDeLinha, perdaDeLinha, saldoDeLinha } from './codec';
import { balanceteLinha, importacao, lancamentoNivel, periodo } from './schema';

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

/**
 * As contas que a empresa já mostrou em algum balancete, uma vez cada.
 *
 * É a base sobre a qual as pendências se calculam: `proporMapeamento` recebe
 * estas linhas e o mapeamento corrente, e devolve o que ainda não foi decidido.
 * Vem na forma de `LinhaBalancete` porque é o que o mapeamento consome — a
 * descrição e o `sintetica` são os da última competência em que a conta
 * apareceu, que é o que o gestor reconhece.
 */
export async function contasDaEmpresa(
  tx: Transacao,
  empresaId: string,
): Promise<readonly LinhaBalancete[]> {
  const linhas = await tx
    .select()
    .from(balanceteLinha)
    .where(eq(balanceteLinha.empresaId, empresaId))
    .orderBy(asc(balanceteLinha.ano), asc(balanceteLinha.mes), asc(balanceteLinha.conta));

  const porConta = new Map<string, LinhaBalancete>();
  for (const l of linhas) {
    porConta.set(l.conta, {
      linha: l.linha,
      codigo: l.conta,
      descricao: l.descricao,
      saldoAnterior: l.saldoAnterior,
      debito: l.debito,
      credito: l.credito,
      saldoAtual: l.saldoAtual,
      grau: l.grau,
      sintetica: l.sintetica,
    });
  }
  return [...porConta.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

/** As importações da empresa, da mais recente à mais antiga. */
export async function importacoesDaEmpresa(
  tx: Transacao,
  empresaId: string,
): Promise<readonly ImportacaoLida[]> {
  const linhas = await tx
    .select()
    .from(importacao)
    .where(eq(importacao.empresaId, empresaId))
    .orderBy(desc(importacao.criadoEm));
  return linhas.map((i) => ({
    id: i.id,
    origem: i.origem,
    artefato: i.artefato as 'balancete' | 'razao',
    competencia: { ano: i.ano, mes: i.mes },
    criadas: i.linhasCriadas,
    atualizadas: i.linhasAtualizadas,
    em: i.criadoEm,
  }));
}

export interface ImportacaoLida {
  readonly id: string;
  readonly origem: string;
  readonly artefato: 'balancete' | 'razao';
  readonly competencia: { readonly ano: number; readonly mes: number };
  readonly criadas: number;
  readonly atualizadas: number;
  readonly em: Date;
}
