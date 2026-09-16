/**
 * As migrações como texto, para quem aplica sem o drizzle-kit.
 *
 * Dois consumidores: os testes, que sobem um PGlite por arquivo, e o app em
 * desenvolvimento, que sobe um PGlite persistido em disco. Os dois aplicam o
 * **mesmo** SQL que vai para produção — os arquivos numerados em ordem, e
 * depois `rls.sql`, que é estado declarativo e idempotente.
 *
 * Ler o disco em vez de chamar `sqlDeRls()` não é preciosismo: o que se quer é
 * que o banco de produção tenha as policies, e chamar a função testaria a
 * função. Se `rls.sql` sair de sincronia com `src/rls.ts`, é aqui que alguém
 * descobre.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA = join(dirname(fileURLToPath(import.meta.url)), '..', 'migracoes');

const ler = (nome: string) => readFileSync(join(PASTA, nome), 'utf8');

/** O DDL numerado, na ordem. Aplica-se **uma vez** por banco. */
export function sqlDoSchema(): string {
  const numeradas = readdirSync(PASTA)
    .filter((nome) => /^\d{4}_.*\.sql$/.test(nome))
    .sort();
  // O drizzle-kit separa statements com `--> statement-breakpoint`.
  return numeradas.map((nome) => ler(nome).split('--> statement-breakpoint').join('\n')).join('\n');
}

/**
 * A RLS. Idempotente: aplica-se em **todo** boot, depois do schema.
 *
 * Separada do DDL de propósito: o schema é aplicado uma vez, e a RLS muda entre
 * versões — uma policy nova ou uma regra corrigida chega ao banco na próxima
 * subida, sem ninguém lembrar de "migrar a RLS".
 */
export function sqlDaRls(): string {
  return ler('rls.sql');
}

/** Os dois juntos, para um banco que nasce agora — o teste. */
export function sqlDasMigracoes(): string {
  return `${sqlDoSchema()}\n${sqlDaRls()}`;
}

/**
 * O papel comum que serve o app, criado se não existir.
 *
 * Em produção esse papel é criado pela operação, uma vez; em desenvolvimento e
 * em teste, por isto. `FORCE ROW LEVEL SECURITY` não contém superusuário
 * (`bug-023`), então sem este papel a RLS não vale.
 */
export const SQL_DO_PAPEL_DA_APLICACAO = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'aplicacao') then
    create role aplicacao nologin;
  end if;
end $$;
grant usage on schema public to aplicacao;
grant select, insert, update, delete on all tables in schema public to aplicacao;
`;
