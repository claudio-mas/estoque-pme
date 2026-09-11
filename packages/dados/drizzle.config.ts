import { defineConfig } from 'drizzle-kit';

/**
 * Só `generate`: as migrações são arquivos versionados no repositório, e não
 * um `push` que sincroniza direto do schema. `push` apaga a única coisa que dá
 * para revisar num PR e que sobrevive à troca de ORM.
 *
 * O que este arquivo **não** cobre são as policies de RLS — o `drizzle-kit` não
 * as modela. Elas entram por arquivo à mão, gerado por `sqlDeRls()`.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migracoes',
});
