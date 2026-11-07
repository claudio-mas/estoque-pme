import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function fixture() {
  return JSON.parse(readFileSync(join(process.env['ESTOQUE_E2E_DIR']!, 'fixture.json'), 'utf8')) as {
    empresaId: string; outraEmpresaId: string; tokenEditor: string; tokenLeitor: string;
  };
}
async function autenticar(context: BrowserContext, token: string) {
  await context.addCookies([{ name: 'authjs.session-token', value: token, url: 'http://127.0.0.1:3100', httpOnly: true, sameSite: 'Lax' }]);
}
const csv = [
  'BALANCETE DE VERIFICAÇÃO',
  'Período: 01/08/2025 a 31/08/2025',
  'Classificação;Descrição;Saldo Anterior;Débito;Crédito;Saldo Atual',
  '1.1.1;DISPONÍVEL;100,00;0,00;0,00;100,00',
  '1.1.3;ESTOQUES;29.350,00;49.200,00;46.550,00;32.000,00',
  '1.1.3.01;MATÉRIAS-PRIMAS;11.000,00;19.500,00;18.500,00;12.000,00',
  '1.1.3.02;PRODUTOS EM PROCESSO;4.500,00;5.200,00;4.700,00;5.000,00',
  '1.1.3.03;PRODUTOS ACABADOS;13.850,00;24.500,00;23.350,00;15.000,00',
  '4.1.1.01;CUSTO DAS MERCADORIAS VENDIDAS;0,00;24.500,00;0,00;24.500,00 D',
].join('\r\n');

async function importar(page: Page, empresaId: string) {
  await page.goto('/empresas/' + empresaId + '/importar');
  await page.getByRole('combobox', { name: /Sistema de origem/ }).fill('ERP de teste');
  await page.locator('input[type=file]').setInputFiles({ name: 'agosto.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  await expect(page.getByText(/criadas, .*atualizadas/)).toBeVisible();
}

test('erro de validação preserva decisões, ausências e motivo sem criar versão', async ({ page, context }) => {
  const dados = fixture();
  await autenticar(context, dados.tokenEditor);
  await importar(page, dados.empresaId);
  await page.goto('/empresas/' + dados.empresaId + '/mapeamento');
  await page.locator('select[name="d:1.1.1"]').selectOption('ignorada');
  await page.getByRole('checkbox', { name: 'PP ausente', exact: true }).check();
  await page.getByRole('textbox', { name: 'Motivo desta versão' }).fill('Classificação do fechamento');
  await page.getByRole('button', { name: 'Salvar mapeamento', exact: true }).click();
  await expect(page.getByText('O nível PP está declarado ausente e ao mesmo tempo tem conta classificada.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Motivo desta versão' })).toHaveValue('Classificação do fechamento');
  await expect(page.locator('select[name="d:1.1.1"]')).toHaveValue('ignorada');
  await expect(page.getByRole('checkbox', { name: 'PP ausente', exact: true })).toBeChecked();
  await expect(page.getByText('nenhuma versão ainda', { exact: true })).toBeVisible();

  const conferencia = await context.newPage();
  await conferencia.goto('/empresas/' + dados.empresaId + '/mapeamento');
  await expect(conferencia.getByText('nenhuma versão ainda', { exact: true })).toBeVisible();
  await conferencia.close();

  await page.getByRole('checkbox', { name: 'PP ausente', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Salvar mapeamento', exact: true }).click();
  await expect(page.getByText(/Versão 1 salva/)).toBeVisible();
  await expect(page.getByText('versão 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Motivo desta versão' })).toHaveValue('');
  await page.locator('select[name="d:1.1.1"]').selectOption('pendente');
  await page.getByRole('checkbox', { name: 'PP ausente', exact: true }).check();
  await page.getByRole('textbox', { name: 'Motivo desta versão' }).fill('Segunda tentativa');
  await page.getByRole('button', { name: 'Salvar mapeamento', exact: true }).click();
  await expect(page.getByText('O nível PP está declarado ausente e ao mesmo tempo tem conta classificada.')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Motivo desta versão' })).toHaveValue('Segunda tentativa');
  await expect(page.locator('select[name="d:1.1.1"]')).toHaveValue('pendente');
  await expect(page.getByRole('checkbox', { name: 'PP ausente', exact: true })).toBeChecked();
  await expect(page.getByText('versão 1', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'PP ausente', exact: true }).uncheck();
  await page.locator('select[name="d:1.1.1"]').selectOption('ignorada');
  await page.getByRole('button', { name: 'Salvar mapeamento', exact: true }).click();
  await expect(page.getByText(/Versão 2 salva/)).toBeVisible();
  await page.reload();
  await expect(page.getByText('versão 2', { exact: true })).toBeVisible();
  await expect(page.locator('select[name="d:1.1.1"]')).toHaveValue('ignorada');
  await importar(page, dados.empresaId);
  await expect(page.getByText(/0 criadas, 6 atualizadas/)).toBeVisible();

});

test('leitor tem todos os campos bloqueados e empresa alheia permanece invisível', async ({ page, context }) => {
  const dados = fixture();
  await autenticar(context, dados.tokenEditor);
  await importar(page, dados.empresaId);
  await autenticar(context, dados.tokenLeitor);
  await page.goto('/empresas/' + dados.empresaId + '/mapeamento');
  await expect(page.getByRole('checkbox', { name: 'PP ausente', exact: true })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Motivo desta versão' })).toBeDisabled();
  await expect(page.locator('select[name="d:1.1.3.01"]')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Salvar mapeamento', exact: true })).toBeDisabled();
  const resposta = await page.goto('/empresas/' + dados.outraEmpresaId + '/mapeamento');
  expect(resposta?.status()).toBe(404);
});

// caret: 'initial' — sem ele o Playwright injeta caret-color nos campos antes da hidratação, e o
// aviso de hidratação do Next abre um selo que cobre o seletor de tema no celular.
test('navegação e temas funcionam no desktop e no celular', async ({ page, context }) => {
  const dados = fixture();
  const erros: string[] = [];
  page.on('pageerror', erro => erros.push(erro.message));
  await autenticar(context, dados.tokenEditor);
  await importar(page, dados.empresaId);
  await page.goto('/empresas/' + dados.empresaId + '/mapeamento');
  await expect(page.getByRole('link', { name: 'Mapeamento', exact: true })).toHaveAttribute('aria-current', 'page');
  const tema = page.getByRole('group', { name: 'Tema da interface' });
  await tema.getByRole('button', { name: 'Escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await page.screenshot({ path: join(process.env['ESTOQUE_E2E_DIR']!, 'mapeamento-escuro.png'), fullPage: true, caret: 'initial' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Navegação principal' })).toBeVisible();
  await tema.getByRole('button', { name: 'Claro', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar navegação', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir navegação', exact: true })).toBeFocused();
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  await page.screenshot({ path: join(process.env['ESTOQUE_E2E_DIR']!, 'mapeamento-celular.png'), fullPage: true, caret: 'initial' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await tema.getByRole('button', { name: 'Sistema', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  await page.screenshot({ path: join(process.env['ESTOQUE_E2E_DIR']!, 'mapeamento-claro.png'), fullPage: true, caret: 'initial' });
  expect(erros).toEqual([]);
});

test('sem sessão a página protegida leva ao login', async ({ page }) => {
  const dados = fixture();
  await page.goto('/empresas/' + dados.empresaId + '/mapeamento');
  await expect(page).toHaveURL(/\/entrar\?/);
  await expect(page.getByRole('button', { name: 'Enviar link de acesso' })).toBeVisible();
});

/** Razão de contraste WCAG entre o texto e o fundo computados de um botão. */
async function contrasteDoBotao(page: Page, nome: string) {
  return page.getByRole('button', { name: nome, exact: true }).evaluate((el) => {
    const luz = (cor: string) => {
      const [r, g, b] = (cor.match(/[\d.]+/g) ?? []).slice(0, 3).map((c) => {
        const v = Number(c) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const estilo = getComputedStyle(el);
    const [a, b] = [luz(estilo.color), luz(estilo.backgroundColor)].sort((x, y) => y - x);
    return (a! + 0.05) / (b! + 0.05);
  });
}

test('botões primários mantêm contraste AA nos dois temas', async ({ page, context }) => {
  const dados = fixture();
  await autenticar(context, dados.tokenEditor);
  await page.goto('/empresas/' + dados.empresaId + '/importar');
  expect(await contrasteDoBotao(page, 'Importar')).toBeGreaterThanOrEqual(4.5);
  await page.getByRole('group', { name: 'Tema da interface' }).getByRole('button', { name: 'Escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  expect(await contrasteDoBotao(page, 'Importar')).toBeGreaterThanOrEqual(4.5);
});
