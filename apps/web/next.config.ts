import type { NextConfig } from 'next';

const config: NextConfig = {
  // Os pacotes do workspace exportam `src/index.ts` cru: o Next tem de compilá-los.
  transpilePackages: [
    '@estoque-pme/motor-calculo',
    '@estoque-pme/importador',
    '@estoque-pme/mapeamento',
    '@estoque-pme/dados',
  ],
  // PGlite carrega wasm e `pg` abre sockets: ficam fora do bundle do servidor.
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'exceljs'],
};

export default config;
