import { defineConfig } from 'vitest/config';

/**
 * PGlite é Postgres compilado para wasm: subir uma instância custa segundos, e
 * o padrão de 10 s do Vitest estoura no `beforeAll` — não por lentidão do
 * teste, mas por inicialização do banco. Um banco por arquivo, com folga para
 * ele nascer.
 */
export default defineConfig({
  test: {
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
