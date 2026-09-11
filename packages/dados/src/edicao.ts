/**
 * Editar o mapeamento e o valor informado — e recalcular na mesma transação.
 *
 * O RF-28 diz que alterar o mapeamento recalcula o histórico afetado. Aqui isso
 * é síncrono e não um job: uma empresa são 24 períodos × 3 níveis, dentro do
 * orçamento de 2 s do RNF com folga, e fila é infraestrutura que o CLAUDE.md
 * proíbe antes do primeiro cliente (ADR-0009).
 *
 * O efeito colateral disso é que as colunas de versão viram **detector**: se
 * alguma linha aparecer defasada, houve bug, e é melhor descobrir por query do
 * que por número errado no relatório.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Mapeamento } from '@estoque-pme/mapeamento';
import type { Competencia } from '@estoque-pme/importador';
import { apurarEmpresa, apurarPeriodo } from './apuracao';
import type { Transacao } from './banco';
import { mapeamentoEntrada, mapeamentoVersao, valorInformado } from './schema';

export interface Edicao {
  readonly empresaId: string;
  readonly usuarioId?: string;
  /** Por que mudou. Vive no cabeçalho da versão, não repetido em cada entrada. */
  readonly motivo?: string;
}

export interface ResultadoDaEdicao {
  readonly versao: number;
  /** Quantos períodos foram reapurados. Zero significa que não havia histórico. */
  readonly periodosReapurados: number;
}

async function proximaVersao(
  tx: Transacao,
  tabela: typeof mapeamentoVersao | typeof valorInformado,
  onde: ReturnType<typeof and>,
): Promise<number> {
  const [ultima] = await tx
    .select({ versao: tabela.versao })
    .from(tabela)
    .where(onde)
    .orderBy(desc(tabela.versao))
    .limit(1);
  return (ultima?.versao ?? 0) + 1;
}

/**
 * Grava uma versão nova do mapeamento e reapura o histórico inteiro.
 *
 * Append-only: a versão anterior fica. "Valor anterior" é a linha anterior, não
 * um campo que alguém precisa lembrar de preencher, e não existe caminho de
 * escrita que perca o histórico.
 */
export async function salvarMapeamento(
  tx: Transacao,
  edicao: Edicao,
  mapeamento: Mapeamento,
): Promise<ResultadoDaEdicao> {
  const versao = await proximaVersao(
    tx,
    mapeamentoVersao,
    eq(mapeamentoVersao.empresaId, edicao.empresaId),
  );

  const [cabecalho] = await tx
    .insert(mapeamentoVersao)
    .values({
      empresaId: edicao.empresaId,
      versao,
      niveisAusentes: [...mapeamento.niveisAusentes],
      ...(edicao.motivo === undefined ? {} : { motivoDaEdicao: edicao.motivo }),
      ...(edicao.usuarioId === undefined ? {} : { criadoPor: edicao.usuarioId }),
    })
    .returning({ id: mapeamentoVersao.id });

  if (cabecalho === undefined) throw new Error('a versão do mapeamento não foi criada');

  if (mapeamento.entradas.length > 0) {
    await tx.insert(mapeamentoEntrada).values(
      mapeamento.entradas.map((e) => ({
        versaoId: cabecalho.id,
        conta: e.codigo,
        descricao: e.descricao,
        decisao: e.decisao.estado,
        ...(e.decisao.estado === 'classificada'
          ? {
              papel: e.decisao.papel.papel,
              ...('nivel' in e.decisao.papel ? { nivel: e.decisao.papel.nivel } : {}),
            }
          : {}),
      })),
    );
  }

  // Mapeamento alterado atinge o histórico inteiro — é a diferença de escopo
  // que a coluna de versão por dependência existe para registrar.
  const periodosReapurados = await apurarEmpresa(tx, edicao.empresaId);
  return { versao, periodosReapurados };
}

/**
 * Grava um valor informado e reapura **um** período.
 *
 * O escopo menor é o ponto do ADR-0009: um hash agregado diria "está defasado"
 * sem dizer por quê, e obrigaria a reapurar tudo a cada número digitado.
 */
export async function salvarValorInformado(
  tx: Transacao,
  edicao: Edicao,
  competencia: Competencia,
  campo: 'custoMateriais',
  valor: bigint,
): Promise<ResultadoDaEdicao> {
  const onde = and(
    eq(valorInformado.empresaId, edicao.empresaId),
    eq(valorInformado.ano, competencia.ano),
    eq(valorInformado.mes, competencia.mes),
    eq(valorInformado.campo, campo),
  );
  const versao = await proximaVersao(tx, valorInformado, onde);

  await tx.insert(valorInformado).values({
    empresaId: edicao.empresaId,
    ano: competencia.ano,
    mes: competencia.mes,
    campo,
    valor,
    versao,
    ...(edicao.usuarioId === undefined ? {} : { criadoPor: edicao.usuarioId }),
  });

  await apurarPeriodo(tx, edicao.empresaId, competencia);
  return { versao, periodosReapurados: 1 };
}

/** Linhas cuja versão de dependência não bate com a corrente: detector de bug. */
export async function periodosDefasados(
  tx: Transacao,
  empresaId: string,
): Promise<readonly Competencia[]> {
  const linhas = await tx.execute(sql`
    select p.ano, p.mes
      from periodo p
      left join lateral (
        select max(v.versao) as versao from mapeamento_versao v where v.empresa_id = p.empresa_id
      ) m on true
      left join lateral (
        select max(i.versao) as versao from valor_informado i
         where i.empresa_id = p.empresa_id and i.ano = p.ano and i.mes = p.mes
      ) vi on true
     where p.empresa_id = ${empresaId}
       and p.estado = 'apurado'
       and (p.versao_mapeamento is distinct from m.versao
            or p.versao_valor_informado is distinct from vi.versao)`);

  // `execute` devolve a forma crua do driver, que varia entre pg e PGlite:
  // `rows` num, o próprio array no outro. Normalizar aqui é mais honesto do que
  // afirmar um tipo que depende de qual driver está ligado.
  const cruas = (Array.isArray(linhas) ? linhas : (linhas as { rows?: unknown[] }).rows) ?? [];
  return (cruas as readonly { ano: number; mes: number }[]).map((l) => ({
    ano: Number(l.ano),
    mes: Number(l.mes),
  }));
}
