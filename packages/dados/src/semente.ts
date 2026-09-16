/**
 * A semente: o primeiro usuário, a primeira empresa, o primeiro vínculo.
 *
 * Empresa **não é criada pelo app** no primeiro corte. O onboarding é feito à
 * mão, do lado do cliente (D9), e uma tela de criação sem portão é a versão
 * que vaza no dia em que houver auto-cadastro. Enquanto esse dia não chega, a
 * policy `empresa_criacao` fica em `with check (true)` como dívida com data, e
 * quem cria é isto — rodando **como dono do banco**, fora da RLS.
 *
 * Rodar como dono não é atalho: o vínculo `usuario_empresa` exige que quem o
 * grava seja editor da empresa, e a primeira empresa não tem editor nenhum
 * ainda. É o ovo e a galinha que só o papel de migração resolve.
 */
import { eq } from 'drizzle-orm';
import type { Banco } from './banco';
import { empresa, usuario, usuarioEmpresa } from './schema';

export interface Semente {
  readonly email: string;
  readonly nome?: string;
  readonly empresa: string;
  readonly papel?: 'editor' | 'leitor';
}

export interface Semeado {
  readonly usuarioId: string;
  readonly empresaId: string;
}

async function usuarioPorEmail(
  tx: Parameters<Parameters<Banco['transaction']>[0]>[0],
  email: string,
  nome?: string,
): Promise<string> {
  const [existente] = await tx
    .select({ id: usuario.id })
    .from(usuario)
    .where(eq(usuario.email, email))
    .limit(1);
  if (existente !== undefined) return existente.id;

  const id = crypto.randomUUID();
  await tx.insert(usuario).values({ id, email, ...(nome === undefined ? {} : { name: nome }) });
  return id;
}

/**
 * Liga um usuário — criado pelo e-mail se preciso — a uma empresa que já existe.
 *
 * É o convite: o sócio que só lê, o contador que também edita. Roda como dono
 * pelo mesmo motivo de `semear`: a policy de `usuario_empresa` exige editor da
 * empresa, e quem convida pelo script não está numa transação com empresa
 * declarada.
 */
export async function vincular(
  banco: Banco,
  vinculo: { readonly email: string; readonly empresaId: string; readonly papel: 'editor' | 'leitor' },
): Promise<Semeado> {
  return banco.transaction(async (tx) => {
    const usuarioId = await usuarioPorEmail(tx, vinculo.email);
    await tx.insert(usuarioEmpresa).values({
      usuarioId,
      empresaId: vinculo.empresaId,
      papel: vinculo.papel,
    });
    return { usuarioId, empresaId: vinculo.empresaId };
  });
}

/**
 * Cria — ou reaproveita — o usuário pelo e-mail, cria a empresa e os liga.
 *
 * O usuário é reaproveitado porque o mesmo controller atende mais de uma
 * empresa (RF-23, D9); a empresa é sempre nova, porque o nome não é chave.
 */
export async function semear(banco: Banco, semente: Semente): Promise<Semeado> {
  return banco.transaction(async (tx) => {
    const usuarioId = await usuarioPorEmail(tx, semente.email, semente.nome);

    const empresaId = crypto.randomUUID();
    await tx.insert(empresa).values({ id: empresaId, nome: semente.empresa });
    await tx.insert(usuarioEmpresa).values({
      usuarioId,
      empresaId,
      papel: semente.papel ?? 'editor',
    });

    return { usuarioId, empresaId };
  });
}
