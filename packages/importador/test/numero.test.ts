/**
 * O parser de valor é onde um erro passa despercebido por mais tempo: ele não
 * quebra, ele devolve o número errado. Daí a densidade de casos aqui.
 */
import { describe, expect, it } from 'vitest';
import { casasDecimais, lerValor } from '../src/index';

const lido = (bruto: string, decimal: ',' | '.' = ',') => {
  const resultado = lerValor(bruto, decimal);
  if (resultado.estado !== 'lido') {
    throw new Error(`"${bruto}" não foi lido: ${JSON.stringify(resultado)}`);
  }
  return resultado;
};

describe('valor monetário em formato brasileiro', () => {
  it('lê milhar com ponto e decimal com vírgula', () => {
    expect(lido('1.234,56').valor).toBe(123_456n);
    expect(lido('12.000,00').valor).toBe(1_200_000n);
    expect(lido('1.234.567,89').valor).toBe(123_456_789n);
    expect(lido('0,01').valor).toBe(1n);
  });

  it('lê sem separador de milhar', () => {
    expect(lido('1234,56').valor).toBe(123_456n);
    expect(lido('1234').valor).toBe(123_400n);
  });

  it('não passa por float: 0,07 é sete centavos exatos', () => {
    // parseFloat('0.07') * 100 === 7.000000000000001 e Math.round salva por
    // acaso; a soma de mil dessas não é salva. Por isso o caminho é string.
    let soma = 0n;
    for (let i = 0; i < 1000; i += 1) soma += lido('0,07').valor;
    expect(soma).toBe(7_000n);
  });

  it('não confunde milhar com decimal', () => {
    // O erro clássico: parseFloat('1.234,56') devolve 1.234, calado.
    expect(lido('1.234').valor).toBe(123_400n);
    expect(lido('1.234', ',').valor).not.toBe(123n);
  });

  it('lê o dialeto internacional quando é esse o dialeto do arquivo', () => {
    expect(lido('1,234.56', '.').valor).toBe(123_456n);
    expect(lido('12000.00', '.').valor).toBe(1_200_000n);
  });

  it('trata parênteses como negativo, convenção contábil', () => {
    expect(lido('(1.234,56)').valor).toBe(-123_456n);
  });

  it('aceita sinal à esquerda e à direita', () => {
    expect(lido('-1.234,56').valor).toBe(-123_456n);
    expect(lido('1.234,56-').valor).toBe(-123_456n);
    expect(lido('+1.234,56').valor).toBe(123_456n);
  });

  it('lê a natureza D/C e aplica o sinal contábil ao valor', () => {
    expect(lido('1.234,56 D')).toMatchObject({ valor: 123_456n, natureza: 'D' });
    expect(lido('1.234,56C')).toMatchObject({ valor: -123_456n, natureza: 'C' });
    expect(lido('D 1.234,56')).toMatchObject({ valor: 123_456n, natureza: 'D' });
  });

  it('crédito em conta de estoque vira saldo negativo, e não uma letra guardada à parte', () => {
    // É o que permite ao RF-03 enxergar estoque negativo como número negativo.
    expect(lido('500,00 C').valor).toBeLessThan(0n);
  });

  it('descarta símbolo de moeda e espaço não separável', () => {
    expect(lido('R$ 1.234,56').valor).toBe(123_456n);
    expect(lido('1.234,56 ').valor).toBe(123_456n);
    expect(lido('R$ 1.234,56').valor).toBe(123_456n);
  });

  it('arredonda ao centavo meio para longe do zero quando vêm mais casas', () => {
    expect(lido('1,005').valor).toBe(101n);
    expect(lido('1,004').valor).toBe(100n);
    expect(lido('(1,005)').valor).toBe(-101n);
  });

  it('distingue vazio de zero', () => {
    expect(lerValor('', ',').estado).toBe('vazio');
    expect(lerValor('   ', ',').estado).toBe('vazio');
    expect(lerValor('-', ',').estado).toBe('vazio');
    expect(lido('0,00').valor).toBe(0n);
  });

  it('recusa o que não é número em vez de devolver NaN ou zero', () => {
    for (const bruto of ['abc', '12,34,56', '1.2.3,4,5', 'R$']) {
      expect(lerValor(bruto, ',').estado).toBe('invalido');
    }
  });

  it('aguenta valor maior que o inteiro seguro de um float', () => {
    expect(lido('999.999.999.999.999,99').valor).toBe(99_999_999_999_999_999n);
  });

  it('conta as casas decimais para o aviso de valor não-monetário', () => {
    expect(casasDecimais('1.234,5678', ',')).toBe(4);
    expect(casasDecimais('1.234,56', ',')).toBe(2);
    expect(casasDecimais('1234', ',')).toBe(0);
  });
});
