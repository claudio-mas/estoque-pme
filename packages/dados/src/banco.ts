/**
 * A conexão, e a única porta por onde se escreve.
 *
 * Toda operação passa por `comEmpresa`, que abre transação e declara
 * `app.empresa_id` com `SET LOCAL`. Não é conveniência: é o que faz a RLS valer
 * — sem a declaração, `current_setting` devolve null, null não casa com nada, e
 * a consulta volta vazia em vez de vazar. A ausência **fecha**.
 *
 * `SET LOCAL` morre no fim da transação, então nada vaza entre requisições num
 * pool. E a conexão é de um papel comum, não de superusuário: quem tem
 * `BYPASSRLS` ignora policy incondicionalmente, e `FORCE ROW LEVEL SECURITY`
 * não muda isso — ele age sobre o dono da tabela.
 */
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

export type Banco = PgDatabase<PgQueryResultHKT, typeof schema>;

/** A transação por dentro de `comEmpresa`: mesma API, escopo já declarado. */
export type Transacao = Parameters<Parameters<Banco['transaction']>[0]>[0];

/**
 * Abre uma transação com a empresa declarada.
 *
 * Tudo o que a importação faz cabe numa transação só, de propósito: o ADR-0009
 * dispensa a fonte de ter coluna de versão **porque** fonte e lançamento são
 * gravados juntos. Quebrar isso em duas transações reintroduz a defasagem que a
 * decisão evitou.
 */
export async function comEmpresa<T>(
  banco: Banco,
  empresaId: string,
  corpo: (tx: Transacao) => Promise<T>,
): Promise<T> {
  return banco.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.empresa_id', ${empresaId}, true)`);
    return corpo(tx);
  });
}
