// Gera o arquivo de migração da RLS. Roda com `npm run migracoes`, depois do
// drizzle-kit: policies não são modeladas pelo Drizzle e entram à mão.
import { writeFileSync } from 'node:fs';
import { sqlDeRls } from './src/rls.ts';

const cabecalho = `-- Gerado por gerar-rls.mjs a partir de src/rls.ts. Não edite à mão.
-- O drizzle-kit não modela policies; sem este arquivo o schema de produção
-- divergiria do que os testes exercitam, e o pior caso é a RLS existir no
-- teste e não no banco.

`;
writeFileSync('migracoes/0001_rls.sql', cabecalho + sqlDeRls(), 'utf8');
console.log('migracoes/0001_rls.sql');
