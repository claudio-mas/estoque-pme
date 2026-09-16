'use server';

/**
 * A action de importar: vários arquivos, um lote, cada um com sua importação.
 *
 * Passa por `naEmpresa` com `exige: 'editor'` — a única porta, reconferindo o
 * vínculo mesmo com o `empresaId` vindo do formulário. Cada arquivo é lido,
 * detectado e gravado na própria transação; um arquivo torto não derruba o
 * lote (RF-01), e o gestor vê o erro naquele arquivo, não no lote.
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { importarBalancete, importarRazao } from '@estoque-pme/dados';
import type { ResumoDaImportacao } from '@estoque-pme/dados';
import { naEmpresa, SemAcesso, SoLeitura } from '@/servidor/acesso';
import { lerArquivo } from '@/servidor/arquivo';

const Entrada = z.object({
  empresaId: z.uuid(),
  origem: z.string().trim().min(1, 'Informe o sistema de origem.').max(80),
});

export interface ResultadoDeArquivo {
  readonly nome: string;
  readonly artefato: 'balancete' | 'razao' | null;
  readonly competencia: string | null;
  readonly resumo: ResumoDaImportacao | null;
  readonly erros: readonly string[];
  readonly avisos: number;
}

export interface EstadoDaImportacao {
  readonly resultados: readonly ResultadoDeArquivo[];
  readonly erro: string | null;
}

const rotulo = (c: { ano: number; mes: number } | null) =>
  c === null ? null : `${String(c.mes).padStart(2, '0')}/${c.ano}`;

export async function importar(
  _anterior: EstadoDaImportacao,
  dados: FormData,
): Promise<EstadoDaImportacao> {
  const entrada = Entrada.safeParse({
    empresaId: dados.get('empresaId'),
    origem: dados.get('origem'),
  });
  if (!entrada.success) {
    return { resultados: [], erro: entrada.error.issues[0]?.message ?? 'Entrada inválida.' };
  }
  const { empresaId, origem } = entrada.data;

  const arquivos = dados
    .getAll('arquivos')
    .filter((a): a is File => a instanceof File && a.size > 0);
  if (arquivos.length === 0) return { resultados: [], erro: 'Escolha ao menos um arquivo.' };

  const resultados: ResultadoDeArquivo[] = [];

  for (const arquivo of arquivos) {
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const lido = await lerArquivo(bytes);

    if (lido.artefato === null) {
      resultados.push({
        nome: arquivo.name,
        artefato: null,
        competencia: null,
        resumo: null,
        erros: [lido.motivo],
        avisos: 0,
      });
      continue;
    }

    const errosDeLeitura = lido.resultado.diagnosticos
      .filter((d) => d.severidade === 'erro')
      .map((d) => d.mensagem);
    const avisos = lido.resultado.diagnosticos.filter((d) => d.severidade !== 'erro').length;

    if (lido.resultado.competencia === null) {
      resultados.push({
        nome: arquivo.name,
        artefato: lido.artefato,
        competencia: null,
        resumo: null,
        erros: [...errosDeLeitura, 'O arquivo não diz a que competência se refere.'],
        avisos,
      });
      continue;
    }

    try {
      const resumo = await naEmpresa(
        empresaId,
        ({ tx, sessao }) =>
          lido.artefato === 'balancete'
            ? importarBalancete(tx, { empresaId, origem, usuarioId: sessao.usuarioId }, lido.resultado)
            : importarRazao(tx, { empresaId, origem, usuarioId: sessao.usuarioId }, lido.resultado),
        { exige: 'editor' },
      );
      resultados.push({
        nome: arquivo.name,
        artefato: lido.artefato,
        competencia: rotulo(lido.resultado.competencia),
        resumo,
        erros: errosDeLeitura,
        avisos,
      });
    } catch (erro) {
      if (erro instanceof SemAcesso || erro instanceof SoLeitura) {
        return { resultados, erro: erro.message };
      }
      resultados.push({
        nome: arquivo.name,
        artefato: lido.artefato,
        competencia: rotulo(lido.resultado.competencia),
        resumo: null,
        erros: [...errosDeLeitura, erro instanceof Error ? erro.message : 'Falha ao gravar.'],
        avisos,
      });
    }
  }

  revalidatePath(`/empresas/${empresaId}`, 'layout');
  return { resultados, erro: null };
}
