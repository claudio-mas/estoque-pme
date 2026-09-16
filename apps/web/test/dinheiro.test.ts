import { describe, expect, it } from 'vitest';
import { centavosDe, formatarCentavos } from '../src/servidor/dinheiro';

describe('dinheiro na fronteira da tela', () => {
  it('lê o que o gestor digita, sem float', () => {
    expect(centavosDe('18.500,00')).toBe(1_850_000n);
    expect(centavosDe('18500,5')).toBe(1_850_050n);
    expect(centavosDe('1234')).toBe(123_400n);
    expect(centavosDe('-0,01')).toBe(-1n);
  });

  it('formata de volta em pt-BR', () => {
    expect(formatarCentavos(1_850_000n)).toBe('R$ 18.500,00');
    expect(formatarCentavos(-1n)).toBe('-R$ 0,01');
  });

  it('não perde o centavo que o float perderia', () => {
    // 0,1 + 0,2 !== 0,3 em float; aqui a soma é exata.
    expect(centavosDe('0,10') + centavosDe('0,20')).toBe(centavosDe('0,30'));
  });
});
