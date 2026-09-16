/**
 * A conexão do app, uma só.
 *
 * Em desenvolvimento, PGlite persistido em disco: Postgres de verdade, sem
 * Docker — que neste Windows não é detalhe pequeno —, e sem a pergunta "o banco
 * está de pé?". Em produção, `node-postgres`. Os dois atrás do mesmo `Banco`
 * que o `dados` abstrai; o app não sabe qual driver está ligado.
 *
 * **Dois papéis, sempre.** A string do app é a de `aplicacao`, um papel comum:
 * `FORCE ROW LEVEL SECURITY` não contém superusuário, e se o app rodar como
 * dono a RLS não vale (`bug-023`). Em PGlite não há strings — a conexão nasce
 * superusuário —, então o próprio módulo migra, cria o papel e faz `set role`
 * antes de entregar o banco. A migração e a semente rodam antes do `set role`,
 * como o papel de dono faria em produção.
 */
import 'server-only';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { SQL_DO_PAPEL_DA_APLICACAO, sqlDaRls, sqlDoSchema, schema } from '@estoque-pme/dados';
import type { Banco } from '@estoque-pme/dados';

/** O banco e, em dev, o handle do PGlite para o Auth.js e a semente. */
export interface Conexao {
  readonly banco: Banco;
  /** Só em desenvolvimento: o mesmo banco, ainda como dono, para semear. */
  readonly comoDono?: <T>(corpo: (banco: Banco) => Promise<T>) => Promise<T>;
}

declare global {
  // eslint-disable-next-line no-var
  var __conexaoEstoquePme: Promise<Conexao> | undefined;
}

async function abrirPglite(pasta: string): Promise<Conexao> {
  const pg = new PGlite(pasta);
  // O DDL numerado não é idempotente: um "já aplicado" simples — se a tabela
  // `empresa` existe, o schema está lá. A RLS é, e muda entre versões: vai em
  // todo boot, senão uma policy corrigida nunca chega ao banco de dev.
  const { rows } = await pg.query<{ existe: boolean }>(
    `select exists (select 1 from information_schema.tables where table_name = 'empresa') as existe`,
  );
  if (!rows[0]?.existe) await pg.exec(sqlDoSchema());
  await pg.exec(sqlDaRls());
  await pg.exec(SQL_DO_PAPEL_DA_APLICACAO);

  const db = drizzlePglite(pg, { schema }) as unknown as Banco;
  await pg.exec('set role aplicacao');

  return {
    banco: db,
    async comoDono(corpo) {
      await pg.exec('reset role');
      try {
        return await corpo(db);
      } finally {
        await pg.exec('set role aplicacao');
      }
    },
  };
}

function abrirPostgres(url: string): Conexao {
  const pool = new Pool({ connectionString: url });
  return { banco: drizzlePg(pool, { schema }) as unknown as Banco };
}

/**
 * Abre — ou reaproveita — a conexão.
 *
 * Guardada em `globalThis` porque o Next.js recarrega módulos em
 * desenvolvimento, e dois PGlite na mesma pasta brigam pelo lock.
 */
export function conexao(): Promise<Conexao> {
  if (globalThis.__conexaoEstoquePme === undefined) {
    const url = process.env['DATABASE_URL'];
    globalThis.__conexaoEstoquePme =
      url !== undefined && url !== ''
        ? Promise.resolve(abrirPostgres(url))
        : abrirPglite(process.env['DADOS_PGLITE'] ?? '.dados');
  }
  return globalThis.__conexaoEstoquePme;
}

export async function banco(): Promise<Banco> {
  return (await conexao()).banco;
}
