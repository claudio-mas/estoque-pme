/**
 * Quem pode o quê: o vínculo e o papel.
 *
 * O app confere o vínculo antes de toda action — e a policy confere de novo.
 * Estas funções são a primeira conferência; a segunda é o banco. Nenhuma das
 * duas confia na outra, e é por isso que uma action chamada por fora, com o
 * `empresaId` trocado no formulário, não chega a lugar nenhum.
 */
import { and, eq } from 'drizzle-orm';
import type { Transacao } from './banco';
import { empresa, usuarioEmpresa } from './schema';

export type Papel = 'editor' | 'leitor';

export interface Vinculo {
  readonly empresaId: string;
  readonly nome: string;
  readonly papel: Papel;
}

/**
 * O papel do usuário corrente na empresa corrente, ou `null`.
 *
 * Roda dentro de `comEmpresa`, com os dois declarados: a policy de
 * `usuario_empresa` só devolve a linha se a empresa bater, então "não achou" e
 * "não tem acesso" são a mesma resposta — e é assim que deve ser.
 */
export async function vinculoDe(
  tx: Transacao,
  empresaId: string,
  usuarioId: string,
): Promise<Papel | null> {
  const [linha] = await tx
    .select({ papel: usuarioEmpresa.papel })
    .from(usuarioEmpresa)
    .where(and(eq(usuarioEmpresa.empresaId, empresaId), eq(usuarioEmpresa.usuarioId, usuarioId)))
    .limit(1);
  return (linha?.papel as Papel | undefined) ?? null;
}

/** As empresas do usuário, para a troca de contexto (RF-23). Roda em `comUsuario`. */
export async function empresasDoUsuario(
  tx: Transacao,
  usuarioId: string,
): Promise<readonly Vinculo[]> {
  const linhas = await tx
    .select({ empresaId: empresa.id, nome: empresa.nome, papel: usuarioEmpresa.papel })
    .from(usuarioEmpresa)
    .innerJoin(empresa, eq(empresa.id, usuarioEmpresa.empresaId))
    .where(eq(usuarioEmpresa.usuarioId, usuarioId))
    .orderBy(empresa.nome);
  return linhas.map((l) => ({ empresaId: l.empresaId, nome: l.nome, papel: l.papel as Papel }));
}
