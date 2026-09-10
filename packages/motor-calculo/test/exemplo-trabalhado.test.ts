/**
 * Fixture dourada: o exemplo trabalhado do PRD, seção 6.
 *
 * Os números realizados são os da planilha de referência do cliente
 * (`estoque.webp`), recalculados em dias reais com d = 30. Se algum destes
 * testes quebrar, ou a matemática do motor mudou ou o PRD mudou — nos dois casos
 * a divergência é para ser resolvida, não silenciada.
 *
 * Valores em R$ milhares, como na planilha.
 */
import { describe, expect, it } from 'vitest';
import {
  calcularPme,
  comprasTeto,
  cobertura,
  mediaDosUltimos,
  producaoTeto,
  projetarEstoque,
} from '../src/index';
import type { Centavos, Pme } from '../src/index';

/** R$ milhares para centavos. */
const mil = (reaisMil: number): Centavos => BigInt(Math.round(reaisMil * 100_000));
/** Centavos de volta para R$ milhares. */
const emMil = (centavos: Centavos): number => Number(centavos) / 100_000;

const REALIZADO = {
  custoMateriais: [mil(17_500), mil(18_500), mil(19_500)],
  cmv: [mil(22_500), mil(23_500), mil(24_500)],
  MP: [mil(10_000), mil(11_000), mil(12_000)],
  PP: [mil(4_200), mil(4_500), mil(5_000)],
  PA: [mil(12_500), mil(13_850), mil(15_000)],
} as const;

const PREVISTO = {
  // Setembro e outubro, do modelo de referência (2% ao mês compostos).
  custoMateriais: [mil(20_288), mil(20_694)],
  cmv: [mil(25_490), mil(26_000)],
} as const;

/** PME de cada mês realizado, pelo saldo de fechamento — como a planilha faz. */
function pmesPorFechamento(saldos: readonly Centavos[], custos: readonly Centavos[]): number[] {
  return saldos.map((saldo, i) => {
    const pme = calcularPme({
      estoqueAbertura: null,
      estoqueFechamento: saldo,
      custoDirecionador: custos[i] as Centavos,
    });
    if (pme.estado !== 'calculado') {
      throw new Error(`PME não calculado no índice ${i}: ${pme.estado}`);
    }
    return pme.dias;
  });
}

describe('exemplo trabalhado — apuração histórica', () => {
  it('reproduz o PME de matérias-primas dos três meses realizados', () => {
    const [jun, jul, ago] = pmesPorFechamento(REALIZADO.MP, REALIZADO.custoMateriais);
    expect(jun).toBeCloseTo(17.14, 2);
    expect(jul).toBeCloseTo(17.84, 2);
    expect(ago).toBeCloseTo(18.46, 2);
  });

  it('reproduz o PME de produtos em processo e acabados', () => {
    const [junPP, julPP, agoPP] = pmesPorFechamento(REALIZADO.PP, REALIZADO.cmv);
    expect(junPP).toBeCloseTo(5.6, 2);
    expect(julPP).toBeCloseTo(5.74, 2);
    expect(agoPP).toBeCloseTo(6.12, 2);

    const [junPA, julPA, agoPA] = pmesPorFechamento(REALIZADO.PA, REALIZADO.cmv);
    expect(junPA).toBeCloseTo(16.67, 2);
    expect(julPA).toBeCloseTo(17.68, 2);
    expect(agoPA).toBeCloseTo(18.37, 2);
  });

  it('confirma que o PME da planilha de referência é exatamente 12x o correto', () => {
    // A planilha aplica 360 a um fluxo mensal e anualiza duas vezes (D4).
    const [jun, , ago] = pmesPorFechamento(REALIZADO.MP, REALIZADO.custoMateriais);
    expect((jun as number) * 12).toBeCloseTo(205.71, 2);
    expect((ago as number) * 12).toBeCloseTo(221.54, 2);
  });

  it('usa o estoque médio quando há saldo de abertura, e diz qual base usou', () => {
    // D5: o padrão é a média. A planilha de referência usa o fechamento, e é por
    // isso que os números acima e os daqui divergem — a divergência é esperada e
    // precisa ser explicada ao cliente na comparação.
    const julho = calcularPme({
      estoqueAbertura: REALIZADO.MP[0] as Centavos,
      estoqueFechamento: REALIZADO.MP[1] as Centavos,
      custoDirecionador: REALIZADO.custoMateriais[1] as Centavos,
    });
    expect(julho).toMatchObject({ estado: 'calculado', base: 'medio' });
    expect((julho as Extract<Pme, { estado: 'calculado' }>).dias).toBeCloseTo(17.03, 2);

    const junho = calcularPme({
      estoqueAbertura: null,
      estoqueFechamento: REALIZADO.MP[0] as Centavos,
      custoDirecionador: REALIZADO.custoMateriais[0] as Centavos,
    });
    expect(junho).toMatchObject({ estado: 'calculado', base: 'fechamento' });
  });

  it('soma a cobertura apenas dos níveis movimentados', () => {
    const pmes = {
      MP: calcularPme({
        estoqueAbertura: null,
        estoqueFechamento: REALIZADO.MP[2] as Centavos,
        custoDirecionador: REALIZADO.custoMateriais[2] as Centavos,
      }),
      PP: calcularPme({
        estoqueAbertura: null,
        estoqueFechamento: REALIZADO.PP[2] as Centavos,
        custoDirecionador: REALIZADO.cmv[2] as Centavos,
      }),
      PA: calcularPme({
        estoqueAbertura: null,
        estoqueFechamento: REALIZADO.PA[2] as Centavos,
        custoDirecionador: REALIZADO.cmv[2] as Centavos,
      }),
    };
    const total = cobertura(pmes);
    expect(total.estado).toBe('calculado');
    if (total.estado !== 'calculado') return;
    expect(total.dias).toBeCloseTo(42.95, 2);
    expect(total.niveis).toEqual(['MP', 'PP', 'PA']);
  });
});

describe('exemplo trabalhado — projeção', () => {
  const premissa = {
    MP: mediaDosUltimos(pmesPorFechamento(REALIZADO.MP, REALIZADO.custoMateriais), 3),
    PP: mediaDosUltimos(pmesPorFechamento(REALIZADO.PP, REALIZADO.cmv), 3),
    PA: mediaDosUltimos(pmesPorFechamento(REALIZADO.PA, REALIZADO.cmv), 3),
  };

  it('deriva a premissa de PME pela média dos três meses realizados', () => {
    expect(premissa.MP).toBeCloseTo(17.81, 2);
    expect(premissa.PP).toBeCloseTo(5.82, 2);
    expect(premissa.PA).toBeCloseTo(17.57, 2);
  });

  it('projeta o estoque de setembro por nível e no total', () => {
    const mp = projetarEstoque(PREVISTO.custoMateriais[0] as Centavos, premissa.MP);
    const pp = projetarEstoque(PREVISTO.cmv[0] as Centavos, premissa.PP);
    const pa = projetarEstoque(PREVISTO.cmv[0] as Centavos, premissa.PA);

    expect(Math.round(emMil(mp))).toBe(12_047);
    expect(Math.round(emMil(pp))).toBe(4_947);
    expect(Math.round(emMil(pa))).toBe(14_930);
    expect(Math.round(emMil(mp + pp + pa))).toBe(31_924);
  });

  it('projeta o estoque de outubro por nível e no total', () => {
    const mp = projetarEstoque(PREVISTO.custoMateriais[1] as Centavos, premissa.MP);
    const pp = projetarEstoque(PREVISTO.cmv[1] as Centavos, premissa.PP);
    const pa = projetarEstoque(PREVISTO.cmv[1] as Centavos, premissa.PA);

    expect(Math.round(emMil(mp))).toBe(12_288);
    expect(Math.round(emMil(pp))).toBe(5_046);
    expect(Math.round(emMil(pa))).toBe(15_229);
    expect(Math.round(emMil(mp + pp + pa))).toBe(32_563);
  });

  it('fica a menos de 0,2% dos totais da planilha de referência', () => {
    const projetar = (indice: 0 | 1): number => {
      const custo = PREVISTO.custoMateriais[indice] as Centavos;
      const cmv = PREVISTO.cmv[indice] as Centavos;
      return emMil(
        projetarEstoque(custo, premissa.MP) +
          projetarEstoque(cmv, premissa.PP) +
          projetarEstoque(cmv, premissa.PA),
      );
    };
    // A divergência vem do método da premissa de PME, não da fórmula.
    expect(Math.abs(projetar(0) - 31_971) / 31_971).toBeLessThan(0.002);
    expect(Math.abs(projetar(1) - 32_610) / 32_610).toBeLessThan(0.002);
  });

  it('calcula os tetos de compra e de produção de setembro', () => {
    const mpAlvo = projetarEstoque(PREVISTO.custoMateriais[0] as Centavos, premissa.MP);
    const paAlvo = projetarEstoque(PREVISTO.cmv[0] as Centavos, premissa.PA);

    const compras = comprasTeto({
      mpAlvo,
      mpInicial: REALIZADO.MP[2] as Centavos,
      custoMateriais: PREVISTO.custoMateriais[0] as Centavos,
    });
    const producao = producaoTeto({
      paAlvo,
      paInicial: REALIZADO.PA[2] as Centavos,
      cmv: PREVISTO.cmv[0] as Centavos,
    });

    expect(Math.round(emMil(compras))).toBe(20_335);
    expect(Math.round(emMil(producao))).toBe(25_420);
  });
});
