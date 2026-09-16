/**
 * O aviso navegável: toda âncora que pode levar a algum lugar, leva.
 */
import { describe, expect, it } from 'vitest';
import { destinoDa } from '../src/servidor/navegacao';

const EMPRESA = 'e1';
const AGOSTO = { ano: 2025, mes: 8 };

describe('destino de uma âncora', () => {
  it('conta vai para a linha dela no mapeamento', () => {
    expect(destinoDa({ tipo: 'conta', conta: '1.1.3.04', nivel: 'MP' }, EMPRESA, AGOSTO)).toEqual({
      href: '/empresas/e1/mapeamento#conta-1.1.3.04',
      rotulo: 'conta 1.1.3.04 (MP)',
    });
  });

  it('linha vai para a linha do balancete na página do período', () => {
    expect(destinoDa({ tipo: 'linha', linha: 42 }, EMPRESA, AGOSTO)?.href).toBe(
      '/empresas/e1/periodos/2025/8#linha-42',
    );
  });

  it('lançamento vai para a linha do razão', () => {
    expect(destinoDa({ tipo: 'lancamento', conta: '1.1.3.01', linha: 7 }, EMPRESA, AGOSTO)?.href).toBe(
      '/empresas/e1/periodos/2025/8#razao-1.1.3.01-7',
    );
  });

  it('arquivo e mapeamento não têm lugar mais específico que a própria página', () => {
    expect(destinoDa({ tipo: 'arquivo' }, EMPRESA, AGOSTO)).toBeNull();
    expect(destinoDa({ tipo: 'mapeamento' }, EMPRESA, AGOSTO)).toBeNull();
  });
});
