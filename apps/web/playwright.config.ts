import { defineConfig, devices } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Cada execução nasce num banco próprio. Nunca abre .dados ou DATABASE_URL do desenvolvedor.
const raiz = resolve('.e2e');
mkdirSync(raiz, { recursive: true });
const pasta = process.env['ESTOQUE_E2E_DIR'] ?? mkdtempSync(join(raiz, 'run-'));
process.env['ESTOQUE_E2E_DIR'] = pasta;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx tsx e2e/preparar.mts && npm run dev -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/entrar',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: '',
      DADOS_PGLITE: join(pasta, 'dados'),
      ESTOQUE_E2E_DIR: pasta,
      AUTH_SECRET: 'estoque-pme-e2e-somente-local-nao-usar-em-producao',
      AUTH_URL: 'http://127.0.0.1:3100',
      AUTH_TRUST_HOST: 'true',
      SMTP_URL: '',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
