/**
 * A única porta entre a sessão e o banco.
 *
 * **Toda Server Action reconfere o vínculo aqui.** Server Action não passa pelo
 * layout — é uma chamada direta, com o `empresaId` vindo do formulário, que é
 * um campo que qualquer um edita. Confiar no layout seria declarar
 * `app.empresa_id` a partir de algo não conferido: entregar a chave da RLS.
 *
 * A conferência é dupla e nenhuma metade confia na outra: `vinculoDe` lê o
 * vínculo dentro da transação já declarada — a policy só devolve a linha se a
 * empresa bater —, e depois toda escrita passa pela policy de novo. Uma action
 * chamada por fora com a empresa trocada não chega a lugar nenhum.
 *
 * `cache` do React memoiza a sessão por passada de renderização, como o guia de
 * autenticação do Next.js recomenda para um DAL.
 */
import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { comEmpresa, comUsuario, empresasDoUsuario, vinculoDe } from '@estoque-pme/dados';
import type { Papel, Transacao, Vinculo } from '@estoque-pme/dados';
import { auth } from './auth';
import { banco } from './banco';

export interface Sessao {
  readonly usuarioId: string;
  readonly email: string;
}

/** A sessão, ou o redirecionamento para entrar. Nunca devolve nulo. */
export const sessaoOuEntrar = cache(async (): Promise<Sessao> => {
  const s = await auth();
  const id = s?.user?.id;
  const email = s?.user?.email;
  if (id === undefined || email === undefined || email === null) redirect('/entrar');
  return { usuarioId: id, email };
});

/** As empresas do usuário da sessão — a troca de contexto (RF-23). */
export async function minhasEmpresas(): Promise<readonly Vinculo[]> {
  const sessao = await sessaoOuEntrar();
  return comUsuario(await banco(), sessao.usuarioId, (tx) => empresasDoUsuario(tx, sessao.usuarioId));
}

export class SemAcesso extends Error {
  constructor(readonly empresaId: string) {
    super('Sem acesso a esta empresa.');
  }
}

export class SoLeitura extends Error {
  constructor() {
    super('Este usuário só pode ler nesta empresa.');
  }
}

export interface Contexto {
  readonly tx: Transacao;
  readonly sessao: Sessao;
  readonly papel: Papel;
}

/**
 * Executa `acao` numa transação com a empresa declarada, depois de conferir o
 * vínculo. `exige: 'editor'` recusa o leitor antes de tentar escrever — a
 * policy recusaria de qualquer forma, mas a mensagem daqui é a que o gestor lê.
 */
export async function naEmpresa<T>(
  empresaId: string,
  acao: (contexto: Contexto) => Promise<T>,
  opcoes: { readonly exige?: Papel } = {},
): Promise<T> {
  const sessao = await sessaoOuEntrar();
  const escopo = { empresaId, usuarioId: sessao.usuarioId };

  return comEmpresa(await banco(), escopo, async (tx) => {
    const papel = await vinculoDe(tx, empresaId, sessao.usuarioId);
    if (papel === null) throw new SemAcesso(empresaId);
    if (opcoes.exige === 'editor' && papel !== 'editor') throw new SoLeitura();
    return acao({ tx, sessao, papel });
  });
}

/** Como `naEmpresa`, mas sem acesso vira 404 em vez de exceção — para páginas. */
export async function naEmpresaOu404<T>(
  empresaId: string,
  acao: (contexto: Contexto) => Promise<T>,
): Promise<T> {
  const { notFound } = await import('next/navigation');
  try {
    return await naEmpresa(empresaId, acao);
  } catch (erro) {
    if (erro instanceof SemAcesso) notFound();
    throw erro;
  }
}
