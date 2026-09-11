/**
 * Importar: gravar a fonte e apurar, numa transação só.
 *
 * A transação única não é zelo — é o que o ADR-0009 assume para dispensar a
 * fonte de ter coluna de versão. Se fonte e lançamento pudessem ser gravados
 * separados, existiria um instante em que a projeção não corresponde à fonte, e
 * a defasagem voltaria a ser possível sem nada a detectar.
 *
 * Reimportar **substitui** pela chave, nunca soma (RF-05). O balancete tem
 * chave natural e é upsert; o razão não tem — dois lançamentos idênticos no
 * mesmo dia são legítimos e indistinguíveis — e é apagado-e-inserido por
 * competência.
 */
import { and, eq } from 'drizzle-orm';
import type { ResultadoBalancete, ResultadoRazao } from '@estoque-pme/importador';
import type { Diagnostico } from '@estoque-pme/importador';
import { apurarPeriodo, type ResultadoApuracao } from './apuracao';
import type { Transacao } from './banco';
import { ancoraParaLinha } from './codec';
import {
  balanceteLinha,
  diagnosticoImportacao,
  importacao,
  razaoConta,
  razaoLancamento,
} from './schema';

export interface DadosDaImportacao {
  readonly empresaId: string;
  /** Obrigatória na primeira importação da empresa (D8, RF-24). */
  readonly origem: string;
  readonly usuarioId?: string;
}

export interface ResumoDaImportacao {
  readonly importacaoId: string;
  /** O resumo do RF-05: o gestor precisa saber que reimportar não duplicou. */
  readonly criadas: number;
  readonly atualizadas: number;
  readonly apuracao: ResultadoApuracao;
}

function competenciaOuErro(
  resultado: { readonly competencia: ResultadoBalancete['competencia'] },
  artefato: string,
) {
  if (resultado.competencia === null) {
    throw new Error(
      `O ${artefato} não diz a que competência se refere, e sem ela não há chave de período (RF-05). ` +
        'Informe a competência na leitura antes de importar.',
    );
  }
  return resultado.competencia;
}

async function abrirImportacao(
  tx: Transacao,
  dados: DadosDaImportacao,
  artefato: 'balancete' | 'razao',
  competencia: { ano: number; mes: number },
  perfil: unknown,
  diagnosticos: readonly Diagnostico[],
): Promise<string> {
  const [linha] = await tx
    .insert(importacao)
    .values({
      empresaId: dados.empresaId,
      origem: dados.origem,
      artefato,
      ano: competencia.ano,
      mes: competencia.mes,
      perfil,
      ...(dados.usuarioId === undefined ? {} : { importadoPor: dados.usuarioId }),
    })
    .returning({ id: importacao.id });

  if (linha === undefined) throw new Error('a importação não foi criada');

  if (diagnosticos.length > 0) {
    await tx.insert(diagnosticoImportacao).values(
      diagnosticos.map((d) => {
        const ancora = ancoraParaLinha(d.ancora);
        return {
          importacaoId: linha.id,
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

  return linha.id;
}

export async function importarBalancete(
  tx: Transacao,
  dados: DadosDaImportacao,
  resultado: ResultadoBalancete,
): Promise<ResumoDaImportacao> {
  const c = competenciaOuErro(resultado, 'balancete');
  const importacaoId = await abrirImportacao(
    tx,
    dados,
    'balancete',
    c,
    resultado.perfil,
    resultado.diagnosticos,
  );

  // Quem já existe é atualizado, quem não existe é criado: é essa a diferença
  // que o resumo do RF-05 mostra, e ela precisa ser medida antes da escrita.
  const existentes = await tx
    .select({ conta: balanceteLinha.conta })
    .from(balanceteLinha)
    .where(
      and(
        eq(balanceteLinha.empresaId, dados.empresaId),
        eq(balanceteLinha.ano, c.ano),
        eq(balanceteLinha.mes, c.mes),
      ),
    );
  const jaGravadas = new Set(existentes.map((e) => e.conta));

  let criadas = 0;
  let atualizadas = 0;

  for (const l of resultado.linhas) {
    if (l.codigo === '') continue;
    const linha = {
      empresaId: dados.empresaId,
      ano: c.ano,
      mes: c.mes,
      conta: l.codigo,
      descricao: l.descricao,
      saldoAnterior: l.saldoAnterior,
      debito: l.debito,
      credito: l.credito,
      saldoAtual: l.saldoAtual,
      grau: l.grau,
      sintetica: l.sintetica,
      linha: l.linha,
      importacaoId,
    };
    await tx
      .insert(balanceteLinha)
      .values(linha)
      .onConflictDoUpdate({
        target: [
          balanceteLinha.empresaId,
          balanceteLinha.ano,
          balanceteLinha.mes,
          balanceteLinha.conta,
        ],
        set: linha,
      });
    if (jaGravadas.has(l.codigo)) atualizadas += 1;
    else criadas += 1;
  }

  await tx
    .update(importacao)
    .set({ linhasCriadas: criadas, linhasAtualizadas: atualizadas })
    .where(eq(importacao.id, importacaoId));

  const apuracao = await apurarPeriodo(tx, dados.empresaId, c);
  return { importacaoId, criadas, atualizadas, apuracao };
}

export async function importarRazao(
  tx: Transacao,
  dados: DadosDaImportacao,
  resultado: ResultadoRazao,
): Promise<ResumoDaImportacao> {
  const c = competenciaOuErro(resultado, 'razão');
  const importacaoId = await abrirImportacao(
    tx,
    dados,
    'razao',
    c,
    resultado.perfil,
    resultado.diagnosticos,
  );

  // Apagar e inserir, não upsert: o razão não tem chave natural de linha, e
  // inventar uma amarraria a identidade do dado ao layout do arquivo.
  const daCompetencia = (t: typeof razaoConta | typeof razaoLancamento) =>
    and(eq(t.empresaId, dados.empresaId), eq(t.ano, c.ano), eq(t.mes, c.mes));

  await tx.delete(razaoLancamento).where(daCompetencia(razaoLancamento));
  await tx.delete(razaoConta).where(daCompetencia(razaoConta));

  for (const conta of resultado.contas) {
    await tx.insert(razaoConta).values({
      empresaId: dados.empresaId,
      ano: c.ano,
      mes: c.mes,
      conta: conta.codigo,
      descricao: conta.descricao,
      saldoAnterior: conta.saldoAnterior,
      saldoAtual: conta.saldoAtual,
      importacaoId,
    });

    if (conta.lancamentos.length === 0) continue;
    await tx.insert(razaoLancamento).values(
      conta.lancamentos.map((l) => ({
        empresaId: dados.empresaId,
        ano: c.ano,
        mes: c.mes,
        conta: conta.codigo,
        linha: l.linha,
        data: l.data,
        historico: l.historico,
        debito: l.debito,
        credito: l.credito,
        contrapartida: l.contrapartida,
      })),
    );
  }

  const criadas = resultado.contas.reduce((n, conta) => n + conta.lancamentos.length, 0);
  await tx
    .update(importacao)
    .set({ linhasCriadas: criadas, linhasAtualizadas: 0 })
    .where(eq(importacao.id, importacaoId));

  const apuracao = await apurarPeriodo(tx, dados.empresaId, c);
  // O razão é reescrito por inteiro, então "atualizadas" não tem sentido aqui —
  // e dizer zero é honesto, não uma lacuna.
  return { importacaoId, criadas, atualizadas: 0, apuracao };
}
