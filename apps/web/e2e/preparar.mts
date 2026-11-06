/** Provisionamento exclusivo do processo E2E. O servidor mantém a autenticação e o DAL reais. */
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { writeFileSync } from 'node:fs';
import { schema, semear, vincular, sqlDoSchema, sqlDaRls, SQL_DO_PAPEL_DA_APLICACAO } from '@estoque-pme/dados';

const pasta = process.env['ESTOQUE_E2E_DIR'];
if (!pasta || !process.env['DADOS_PGLITE']) throw new Error('E2E exige pasta e banco isolados.');
const relativo = relative(resolve('.e2e'), resolve(pasta));
if (!relativo || relativo.startsWith('..') || isAbsolute(relativo) ||
    resolve(process.env['DADOS_PGLITE']) !== join(resolve(pasta), 'dados')) {
  throw new Error('O banco E2E deve ficar dentro de .e2e/run-*/dados.');
}
const pg = new PGlite(process.env['DADOS_PGLITE']);
try {
  await pg.exec(sqlDoSchema());
  await pg.exec(sqlDaRls());
  await pg.exec(SQL_DO_PAPEL_DA_APLICACAO);
  const db = drizzle(pg, { schema });
  const editor = await semear(db as never, { email: 'gestor@teste.example', empresa: 'Alimentos Boa Safra · teste' });
  const leitor = await vincular(db as never, { email: 'leitor@teste.example', empresaId: editor.empresaId, papel: 'leitor' });
  const outra = await semear(db as never, { email: 'outro@teste.example', empresa: 'Outra empresa · teste' });
  const tokenEditor = crypto.randomUUID();
  const tokenLeitor = crypto.randomUUID();
  await db.insert(schema.sessao).values([
    { sessionToken: tokenEditor, userId: editor.usuarioId, expires: new Date(Date.now() + 3_600_000) },
    { sessionToken: tokenLeitor, userId: leitor.usuarioId, expires: new Date(Date.now() + 3_600_000) },
  ]);
  writeFileSync(join(pasta, 'fixture.json'), JSON.stringify({
    empresaId: editor.empresaId, outraEmpresaId: outra.empresaId, tokenEditor, tokenLeitor,
  }));
} finally {
  await pg.close();
}
