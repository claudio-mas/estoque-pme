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
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { ContaRazao, LinhaBalancete } from '@estoque-pme/importador';
import type { Ancora, Lancamento, Nivel } from '@estoque-pme/motor-calculo';
import type { Transacao } from './banco';
import { ancoraDeLinha, consumoDeLinha, custoMateriaisDeLinha, perdaDeLinha, saldoDeLinha } from './codec';
import {
  balanceteLinha,
  diagnosticoImportacao,
  diagnosticoPeriodo,
  importacao,
  lancamentoNivel,
  periodo,
  razaoConta,
  razaoLancamento,
} from './schema';

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

/** Um diagnóstico como a tela o vê: decodificado, com a âncora inteira. */
export interface DiagnosticoLido {
  readonly origem: 'arquivo' | 'mapeamento';
  readonly severidade: 'erro' | 'aviso' | 'info';
  readonly codigo: string;
  readonly mensagem: string;
  readonly ancora: Ancora;
}

export interface PeriodoDetalhado {
  readonly competencia: { readonly ano: number; readonly mes: number };
  readonly periodo: PeriodoLido;
  /** Do mapeamento — recalculável, keyed no período (ADR-0009). */
  readonly diagnosticos: readonly DiagnosticoLido[];
  /** As linhas do balancete como importadas: é o destino da âncora `linha`. */
  readonly linhas: readonly LinhaBalancete[];
  /** O razão do período, se importado: destino da âncora `lancamento`. */
  readonly razao: readonly ContaRazao[];
  readonly importacoes: readonly ImportacaoLida[];
}

/**
 * Tudo o que a página do período mostra, numa leitura só.
 *
 * Os diagnósticos vêm de dois lugares por natureza (ADR-0009): os do arquivo
 * são imutáveis e moram na importação; os do mapeamento são reescritos a cada
 * apuração e moram no período. A tela os lista juntos, mas com a origem dita.
 */
export async function periodoDetalhado(
  tx: Transacao,
  empresaId: string,
  c: { readonly ano: number; readonly mes: number },
): Promise<PeriodoDetalhado | null> {
  const todos = await lancamentosDaEmpresa(tx, empresaId);
  const periodo = todos.find((p) => {
    const comp = p.estado === 'apurado' ? p.lancamento.competencia : p.competencia;
    return comp.ano === c.ano && comp.mes === c.mes;
  });
  if (periodo === undefined) return null;

  const daCompetencia = (
    t: typeof diagnosticoPeriodo | typeof balanceteLinha | typeof razaoConta | typeof razaoLancamento,
  ) => and(eq(t.empresaId, empresaId), eq(t.ano, c.ano), eq(t.mes, c.mes));

  const doPeriodo = await tx
    .select()
    .from(diagnosticoPeriodo)
    .where(daCompetencia(diagnosticoPeriodo));

  const importacoes = (await importacoesDaEmpresa(tx, empresaId)).filter(
    (i) => i.competencia.ano === c.ano && i.competencia.mes === c.mes,
  );
  const doArquivo =
    importacoes.length === 0
      ? []
      : await tx
          .select()
          .from(diagnosticoImportacao)
          .where(
            inArray(
              diagnosticoImportacao.importacaoId,
              importacoes.map((i) => i.id),
            ),
          );

  const decodificar = (
    d: {
      severidade: string;
      codigo: string;
      mensagem: string;
      ancoraTipo: string | null;
      ancoraLinha: number | null;
      ancoraColuna: string | null;
      ancoraConta: string | null;
      ancoraNivel: string | null;
    },
    origem: 'arquivo' | 'mapeamento',
  ): DiagnosticoLido => ({
    origem,
    severidade: d.severidade as DiagnosticoLido['severidade'],
    codigo: d.codigo,
    mensagem: d.mensagem,
    ancora: ancoraDeLinha({
      tipo: d.ancoraTipo,
      linha: d.ancoraLinha,
      coluna: d.ancoraColuna,
      conta: d.ancoraConta,
      nivel: d.ancoraNivel,
    }),
  });

  const linhas = await tx.select().from(balanceteLinha).where(daCompetencia(balanceteLinha));
  const contas = await tx.select().from(razaoConta).where(daCompetencia(razaoConta));
  const lancamentos = await tx.select().from(razaoLancamento).where(daCompetencia(razaoLancamento));

  return {
    competencia: c,
    periodo,
    diagnosticos: [
      ...doArquivo.map((d) => decodificar(d, 'arquivo')),
      ...doPeriodo.map((d) => decodificar(d, 'mapeamento')),
    ],
    linhas: linhas.map((l) => ({
      linha: l.linha,
      codigo: l.conta,
      descricao: l.descricao,
      saldoAnterior: l.saldoAnterior,
      debito: l.debito,
      credito: l.credito,
      saldoAtual: l.saldoAtual,
      grau: l.grau,
      sintetica: l.sintetica,
    })),
    razao: contas.map((conta) => ({
      codigo: conta.conta,
      descricao: conta.descricao,
      saldoAnterior: conta.saldoAnterior,
      saldoAtual: conta.saldoAtual,
      lancamentos: lancamentos
        .filter((l) => l.conta === conta.conta)
        .map((l) => ({
          linha: l.linha,
          data: l.data,
          historico: l.historico,
          debito: l.debito,
          credito: l.credito,
          contrapartida: l.contrapartida,
        })),
    })),
    importacoes,
  };
}
