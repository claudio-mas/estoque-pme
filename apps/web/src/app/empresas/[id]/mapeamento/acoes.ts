'use server';

/**
 * Salvar o mapeamento: uma versão, uma reapuração, em lote.
 *
 * O formulário é o rascunho — o gestor classifica quantas contas quiser e
 * "salvar" grava **uma** versão (ADR-0009). Por clique seria uma versão por
 * conta, e o histórico de auditoria viraria ruído em vez de trilha.
 *
 * A validação roda **antes** de gravar, e a mensagem daqui é a que o gestor lê.
 * O `aplicarMapeamento` revalida de qualquer forma na apuração — é a segunda
 * conferência do ADR-0002, e as duas continuam existindo.
 */
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { salvarMapeamento } from '@estoque-pme/dados';
import { validarMapeamento } from '@estoque-pme/mapeamento';
import { mapeamentoDoFormulario } from './decisoes';
import { naEmpresa, SemAcesso, SoLeitura } from '@/servidor/acesso';

const Entrada = z.object({
  empresaId: z.uuid(),
  motivo: z.string().trim().max(200).optional(),
});

export interface EstadoDoMapeamento {
  readonly versao: number | null;
  readonly periodosReapurados: number;
  readonly erros: readonly string[];
  readonly avisos: readonly string[];
}

const INICIAL: EstadoDoMapeamento = { versao: null, periodosReapurados: 0, erros: [], avisos: [] };

export async function salvar(
  _anterior: EstadoDoMapeamento,
  dados: FormData,
): Promise<EstadoDoMapeamento> {
  const entrada = Entrada.safeParse({
    empresaId: dados.get('empresaId'),
    motivo: dados.get('motivo') ?? undefined,
  });
  if (!entrada.success) {
    return { ...INICIAL, erros: [entrada.error.issues[0]?.message ?? 'Entrada inválida.'] };
  }
  const { empresaId, motivo } = entrada.data;

  const lido = mapeamentoDoFormulario(dados);
  if (!lido.ok) return { ...INICIAL, erros: [lido.erro] };
  const { mapeamento } = lido;

  const diagnosticos = validarMapeamento(mapeamento);
  const erros = diagnosticos.filter((d) => d.severidade === 'erro').map((d) => d.mensagem);
  const avisos = diagnosticos.filter((d) => d.severidade !== 'erro').map((d) => d.mensagem);
  if (erros.length > 0) return { ...INICIAL, erros, avisos };

  try {
    const resultado = await naEmpresa(
      empresaId,
      ({ tx, sessao }) =>
        salvarMapeamento(
          tx,
          { empresaId, usuarioId: sessao.usuarioId, ...(motivo ? { motivo } : {}) },
          mapeamento,
        ),
      { exige: 'editor' },
    );
    revalidatePath(`/empresas/${empresaId}`, 'layout');
    return { versao: resultado.versao, periodosReapurados: resultado.periodosReapurados, erros: [], avisos };
  } catch (erro) {
    if (erro instanceof SemAcesso || erro instanceof SoLeitura) return { ...INICIAL, erros: [erro.message] };
    throw erro;
  }
}
