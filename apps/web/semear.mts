/**
 * Semeia usuário, empresa e vínculo no banco de desenvolvimento.
 *
 *   npm run semear --workspace @estoque-pme/web -- voce@empresa.com.br "Alimentos Boa Safra Ltda"
 *
 * Roda como dono — é o papel de migração —, porque o primeiro vínculo de uma
 * empresa não pode ser gravado por um editor dela: ainda não há nenhum.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { SQL_DO_PAPEL_DA_APLICACAO, schema, semear, sqlDaRls, sqlDoSchema } from '@estoque-pme/dados';

const [email, nome] = process.argv.slice(2);
if (!email || !nome) {
  console.error('uso: npm run semear -- <email> "<nome da empresa>"');
  process.exit(1);
}

const pg = new PGlite(process.env['DADOS_PGLITE'] ?? '.dados');
const { rows } = await pg.query<{ existe: boolean }>(
  `select exists (select 1 from information_schema.tables where table_name = 'empresa') as existe`,
);
if (!rows[0]?.existe) await pg.exec(sqlDoSchema());
await pg.exec(sqlDaRls());
await pg.exec(SQL_DO_PAPEL_DA_APLICACAO);

const banco = drizzle(pg, { schema });
const semeado = await semear(banco as never, { email, empresa: nome });
console.log(`empresa ${semeado.empresaId} · usuário ${semeado.usuarioId} (${email}) · editor`);
await pg.close();
