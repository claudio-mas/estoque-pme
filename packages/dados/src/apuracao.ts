/**
 * Materializar o lançamento a partir da fonte.
 *
 * O `Lancamento` é resultado, não entrada: aplicar o mapeamento ao balancete e
 * ao razão. Guardá-lo é cache — e é por isso que a fonte é persistida, e por
 * isso que a linha grava a versão de cada dependência (ADR-0009). Aqui está a
 * função que reconstrói, e que o recálculo do RF-28 chama para cada período
 * afetado.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { Competencia, ResultadoBalancete, ResultadoRazao } from '@estoque-pme/importador';
import { aplicarMapeamento } from '@estoque-pme/mapeamento';
import type { Mapeamento } from '@estoque-pme/mapeamento';
import { mensagemDoMotivo } from '@estoque-pme/motor-calculo';
import type { Nivel } from '@estoque-pme/motor-calculo';
import type { Transacao } from './banco';
import {
  ancoraParaLinha,
  consumoParaLinha,
  custoMateriaisParaLinha,
  motivoParaLinha,
  perdaParaLinha,
  saldoParaLinha,
} from './codec';
import {
  balanceteLinha,
  diagnosticoPeriodo,
  importacao,
  lancamentoNivel,
  mapeamentoEntrada,
  mapeamentoVersao,
  periodo,
  razaoConta,
  razaoLancamento,
  valorInformado,
} from './schema';

const NIVEIS: readonly Nivel[] = ['MP', 'PP', 'PA'];

/** O mapeamento corrente da empresa, com a versão que o produziu. */
export async function mapeamentoCorrente(
  tx: Transacao,
  empresaId: string,
): Promise<{ readonly mapeamento: Mapeamento; readonly versao: number } | null> {
  const versoes = await tx
    .select()
    .from(mapeamentoVersao)
    .where(eq(mapeamentoVersao.empresaId, empresaId))
    .orderBy(sql`${mapeamentoVersao.versao} desc`)
    .limit(1);

  const atual = versoes[0];
  if (atual === undefined) return null;

  const entradas = await tx
    .select()
    .from(mapeamentoEntrada)
    .where(eq(mapeamentoEntrada.versaoId, atual.id));

  return {
    versao: atual.versao,
    mapeamento: {
      niveisAusentes: atual.niveisAusentes as Nivel[],
      entradas: entradas.map((e) => ({
        codigo: e.conta,
        descricao: e.descricao,
        decisao:
          e.decisao === 'ignorada'
            ? { estado: 'ignorada' as const }
            : {
                estado: 'classificada' as const,
                papel:
                  e.papel === 'estoque' || e.papel === 'baixa'
                    ? { papel: e.papel, nivel: e.nivel as Nivel }
                    : { papel: e.papel as 'cmv' | 'receita' },
              },
      })),
    },
  };
}

/** A fonte de um período, remontada na forma que o mapeamento consome. */
async function fonteDoPeriodo(
  tx: Transacao,
  empresaId: string,
  c: Competencia,
): Promise<{ balancete: ResultadoBalancete; razao: ResultadoRazao | undefined }> {
  const daEmpresa = (t: typeof balanceteLinha | typeof razaoConta | typeof razaoLancamento) =>
    and(eq(t.empresaId, empresaId), eq(t.ano, c.ano), eq(t.mes, c.mes));

  const linhas = await tx.select().from(balanceteLinha).where(daEmpresa(balanceteLinha));
  const contas = await tx.select().from(razaoConta).where(daEmpresa(razaoConta));
  const lancamentos = await tx.select().from(razaoLancamento).where(daEmpresa(razaoLancamento));

  // O perfil guardado diz se o arquivo trazia colunas de movimento — é o que
  // decide entre `débito − crédito` e a diferença de saldos (ADR-0003).
  const [importacoes] = await tx
    .select()
    .from(importacao)
    .where(
      and(
        eq(importacao.empresaId, empresaId),
        eq(importacao.ano, c.ano),
        eq(importacao.mes, c.mes),
        eq(importacao.artefato, 'balancete'),
      ),
    )
    .orderBy(sql`${importacao.criadoEm} desc`)
    .limit(1);

  return {
    balancete: {
      competencia: c,
      diagnosticos: [],
      perfil: (importacoes?.perfil ?? null) as ResultadoBalancete['perfil'],
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
    },
    razao:
      contas.length === 0
        ? undefined
        : {
            competencia: c,
            diagnosticos: [],
            perfil: null,
            contas: contas.map((conta) => ({
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
          },
  };
}

/** O valor informado corrente de um campo, com a versão dele. */
async function informadoCorrente(
  tx: Transacao,
  empresaId: string,
  c: Competencia,
): Promise<{ readonly valor: bigint; readonly versao: number } | null> {
  const [linha] = await tx
    .select()
    .from(valorInformado)
    .where(
      and(
        eq(valorInformado.empresaId, empresaId),
        eq(valorInformado.ano, c.ano),
        eq(valorInformado.mes, c.mes),
        eq(valorInformado.campo, 'custoMateriais'),
      ),
    )
    .orderBy(sql`${valorInformado.versao} desc`)
    .limit(1);

  return linha === undefined ? null : { valor: linha.valor, versao: linha.versao };
}

export interface ResultadoApuracao {
  readonly estado: 'importado' | 'apurado';
  readonly diagnosticos: number;
}

/**
 * Reconstrói o período inteiro: lançamento, níveis e diagnósticos de mapeamento.
 *
 * Sem mapeamento — o caso de toda primeira importação, já que ele nasce das
 * contas que o arquivo revelou — o período fica `importado` e os níveis são
 * apagados. Escrever níveis `indefinido` aqui reintroduziria pela persistência
 * o número que o motor se recusou a produzir.
 */
export async function apurarPeriodo(
  tx: Transacao,
  empresaId: string,
  c: Competencia,
): Promise<ResultadoApuracao> {
  const corrente = await mapeamentoCorrente(tx, empresaId);
  const { balancete, razao } = await fonteDoPeriodo(tx, empresaId, c);
  const informado = await informadoCorrente(tx, empresaId, c);

  const chave = and(
    eq(diagnosticoPeriodo.empresaId, empresaId),
    eq(diagnosticoPeriodo.ano, c.ano),
    eq(diagnosticoPeriodo.mes, c.mes),
  );
  await tx.delete(diagnosticoPeriodo).where(chave);

  if (corrente === null) {
    await tx
      .delete(lancamentoNivel)
      .where(
        and(
          eq(lancamentoNivel.empresaId, empresaId),
          eq(lancamentoNivel.ano, c.ano),
          eq(lancamentoNivel.mes, c.mes),
        ),
      );
    await gravarPeriodo(tx, empresaId, c, { estado: 'importado' });
    return { estado: 'importado', diagnosticos: 0 };
  }

  const resultado = aplicarMapeamento(corrente.mapeamento, balancete, {
    ...(razao === undefined ? {} : { razao }),
    ...(informado === null ? {} : { custoMateriaisInformado: informado.valor }),
  });

  if (resultado.diagnosticos.length > 0) {
    await tx.insert(diagnosticoPeriodo).values(
      resultado.diagnosticos.map((d) => {
        const ancora = ancoraParaLinha(d.ancora);
        return {
          empresaId,
          ano: c.ano,
          mes: c.mes,
          severidade: d.severidade,
          codigo: d.codigo,
          mensagem: d.mensagem,
          ancoraTipo: ancora.tipo,
          ancoraLinha: ancora.linha,
          ancoraColuna: ancora.coluna,
          ancoraConta: ancora.conta,
          ancoraNivel: ancora.nivel,
        };
      }),
    );
  }

  const lancamento = resultado.lancamento;
  if (lancamento === null) {
    await tx
      .delete(lancamentoNivel)
      .where(
        and(
          eq(lancamentoNivel.empresaId, empresaId),
          eq(lancamentoNivel.ano, c.ano),
          eq(lancamentoNivel.mes, c.mes),
        ),
      );
    await gravarPeriodo(tx, empresaId, c, { estado: 'importado' });
    return { estado: 'importado', diagnosticos: resultado.diagnosticos.length };
  }

  const custo = custoMateriaisParaLinha(lancamento.custoMateriais);
  await gravarPeriodo(tx, empresaId, c, {
    estado: 'apurado',
    cmv: lancamento.cmv,
    receita: lancamento.receita,
    compras: lancamento.compras,
    custoMateriaisOrigem: custo.origem,
    custoMateriaisValor: custo.valor,
    custoMateriaisInformado: custo.informado,
    custoMateriaisMotivoCodigo: custo.motivo.codigo,
    custoMateriaisMotivoAncoraTipo: custo.motivo.tipo,
    custoMateriaisMotivoAncoraLinha: custo.motivo.linha,
    custoMateriaisMotivoAncoraColuna: custo.motivo.coluna,
    custoMateriaisMotivoAncoraConta: custo.motivo.conta,
    custoMateriaisMotivoAncoraNivel: custo.motivo.nivel,
    versaoMapeamento: corrente.versao,
    versaoValorInformado: informado?.versao ?? null,
  });

  // Nível ausente é linha explícita: os três são sempre gravados (ADR-0008).
  for (const nivel of NIVEIS) {
    const saldo = saldoParaLinha(lancamento.estoque[nivel]);
    const consumo = consumoParaLinha(lancamento.consumo[nivel]);
    const perda = perdaParaLinha(lancamento.perdas[nivel]);

    // Uma linha só, usada no insert e no update: duas listas de colunas
    // divergem, e a que diverge é sempre a do update.
    const linha = {
      empresaId,
      ano: c.ano,
      mes: c.mes,
      nivel,
      estoqueEstado: saldo.estado,
      estoqueAbertura: saldo.abertura,
      estoqueFechamento: saldo.fechamento,
      estoqueMotivoCodigo: saldo.motivo.codigo,
      estoqueMotivoAncoraTipo: saldo.motivo.tipo,
      estoqueMotivoAncoraLinha: saldo.motivo.linha,
      estoqueMotivoAncoraColuna: saldo.motivo.coluna,
      estoqueMotivoAncoraConta: saldo.motivo.conta,
      estoqueMotivoAncoraNivel: saldo.motivo.nivel,
      consumoEstado: consumo.estado,
      consumoValor: consumo.valor,
      consumoMotivoCodigo: consumo.motivo.codigo,
      consumoMotivoAncoraTipo: consumo.motivo.tipo,
      consumoMotivoAncoraLinha: consumo.motivo.linha,
      consumoMotivoAncoraColuna: consumo.motivo.coluna,
      consumoMotivoAncoraConta: consumo.motivo.conta,
      consumoMotivoAncoraNivel: consumo.motivo.nivel,
      perdasEstado: perda.estado,
      perdasValor: perda.valor,
    };

    await tx
      .insert(lancamentoNivel)
      .values(linha)
      .onConflictDoUpdate({
        target: [
          lancamentoNivel.empresaId,
          lancamentoNivel.ano,
          lancamentoNivel.mes,
          lancamentoNivel.nivel,
        ],
        set: linha,
      });
  }

  return { estado: 'apurado', diagnosticos: resultado.diagnosticos.length };
}

/**
 * Grava o período, zerando o que a variante anterior tenha deixado.
 *
 * `vazio` não é zelo: sem ele, um período que era `apurado` e volta a
 * `importado` — porque o mapeamento perdeu o CMV, por exemplo — manteria o
 * custo de materiais da apuração anterior pendurado, e o `CHECK` do estado
 * deixaria passar. Reescrever tudo é o que faz a linha refletir só a apuração
 * corrente.
 */
type CamposDePeriodo = Partial<typeof periodo.$inferInsert> & {
  readonly estado: 'importado' | 'apurado';
};

async function gravarPeriodo(
  tx: Transacao,
  empresaId: string,
  c: Competencia,
  campos: CamposDePeriodo,
): Promise<void> {
  const vazio = {
    cmv: null,
    receita: null,
    compras: null,
    custoMateriaisOrigem: null,
    custoMateriaisValor: null,
    custoMateriaisInformado: null,
    custoMateriaisMotivoCodigo: null,
    custoMateriaisMotivoAncoraTipo: null,
    custoMateriaisMotivoAncoraLinha: null,
    custoMateriaisMotivoAncoraColuna: null,
    custoMateriaisMotivoAncoraConta: null,
    custoMateriaisMotivoAncoraNivel: null,
    versaoMapeamento: null,
    versaoValorInformado: null,
  };
  const linha = { empresaId, ano: c.ano, mes: c.mes, ...vazio, ...campos };
  await tx
    .insert(periodo)
    .values(linha)
    .onConflictDoUpdate({
      target: [periodo.empresaId, periodo.ano, periodo.mes],
      set: { ...vazio, ...campos, atualizadoEm: new Date() },
    });
}

/** Reapura todos os períodos de uma empresa. É o recálculo do RF-28. */
export async function apurarEmpresa(tx: Transacao, empresaId: string): Promise<number> {
  const periodos = await tx
    .selectDistinct({ ano: balanceteLinha.ano, mes: balanceteLinha.mes })
    .from(balanceteLinha)
    .where(eq(balanceteLinha.empresaId, empresaId));

  for (const c of periodos) await apurarPeriodo(tx, empresaId, c);
  return periodos.length;
}

/** A frase de um diagnóstico guardado, montada do código na leitura. */
export { mensagemDoMotivo };
