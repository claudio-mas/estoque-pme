'use server';

/**
 * Informar o custo de materiais: um valor, uma versão, um período reapurado.
 *
 * É a única entrada humana sobre um período já realizado (ADR-0010), e é a
 * que faz MP funcionar sem razão (ADR-0006). Passa por `naEmpresa` com
 * `exige: 'editor'` como toda escrita. Reapura só este período — é a diferença
 * de escopo que justificou uma coluna de versão por dependência.
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { salvarValorInformado } from '@estoque-pme/dados';
import { naEmpresa, SemAcesso, SoLeitura } from '@/servidor/acesso';
import { centavosDe } from '@/servidor/dinheiro';

const Entrada = z.object({
  empresaId: z.uuid(),
  ano: z.coerce.number().int().min(1900).max(2999),
  mes: z.coerce.number().int().min(1).max(12),
  /** Em reais, como o gestor digita: "18.500,00". Vira centavos aqui, nunca float. */
  valor: z
    .string()
    .trim()
    .regex(/^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$|^-?\d+(,\d{1,2})?$/, 'Use o formato 18.500,00.'),
});

export interface EstadoDoInforme {
  readonly versao: number | null;
  readonly erro: string | null;
}

export async function informar(_anterior: EstadoDoInforme, dados: FormData): Promise<EstadoDoInforme> {
  const entrada = Entrada.safeParse({
    empresaId: dados.get('empresaId'),
    ano: dados.get('ano'),
    mes: dados.get('mes'),
    valor: dados.get('valor'),
  });
  if (!entrada.success) {
    return { versao: null, erro: entrada.error.issues[0]?.message ?? 'Entrada inválida.' };
  }
  const { empresaId, ano, mes, valor } = entrada.data;

  try {
    const resultado = await naEmpresa(
      empresaId,
      ({ tx, sessao }) =>
        salvarValorInformado(
          tx,
          { empresaId, usuarioId: sessao.usuarioId },
          { ano, mes },
          'custoMateriais',
          centavosDe(valor),
        ),
      { exige: 'editor' },
    );
    revalidatePath(`/empresas/${empresaId}`, 'layout');
    return { versao: resultado.versao, erro: null };
  } catch (erro) {
    if (erro instanceof SemAcesso || erro instanceof SoLeitura) return { versao: null, erro: erro.message };
    throw erro;
  }
}
