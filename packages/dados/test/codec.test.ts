/**
 * Ida e volta: união → linha → união.
 *
 * O `CHECK` garante que a linha é representável; isto garante que ela vira a
 * união certa e volta igual. Sem a volta exercitada, restaria uma função de
 * inferência escrita à mão — que é onde um bug mora para sempre (ADR-0008).
 */
import { describe, expect, it } from 'vitest';
import { motivoDaConta, motivoDoNivel } from '@estoque-pme/motor-calculo';
import type { Ancora, ConsumoDeNivel, CustoDeMateriais, SaldoDeNivel } from '@estoque-pme/motor-calculo';
import {
  ancoraDeLinha,
  ancoraParaLinha,
  consumoDeLinha,
  consumoParaLinha,
  custoMateriaisDeLinha,
  custoMateriaisParaLinha,
  perdaDeLinha,
  perdaParaLinha,
  saldoDeLinha,
  saldoParaLinha,
} from '../src/index';

const ANCORAS: readonly Ancora[] = [
  { tipo: 'arquivo' },
  { tipo: 'mapeamento' },
  { tipo: 'linha', linha: 42 },
  { tipo: 'linha', linha: 42, coluna: 'saldo atual' },
  { tipo: 'conta', conta: '1.1.3.01' },
  { tipo: 'conta', conta: '1.1.3.04', nivel: 'MP' },
  { tipo: 'nivel', nivel: 'PP' },
  { tipo: 'lancamento', conta: '1.1.3.01', linha: 7 },
];

describe('âncora', () => {
  it.each(ANCORAS.map((a) => [a.tipo, a] as const))('sobrevive à ida e volta: %s', (_nome, ancora) => {
    expect(ancoraDeLinha(ancoraParaLinha(ancora))).toEqual(ancora);
  });

  it('recusa linha impossível em vez de adivinhar', () => {
    // Só chega aqui quem furou o CHECK: é defeito de programação, não dado ruim.
    expect(() =>
      ancoraDeLinha({ tipo: 'conta', conta: null, linha: null, coluna: null, nivel: null }),
    ).toThrow(/impossível/);
    expect(() =>
      ancoraDeLinha({ tipo: 'inventado', conta: null, linha: null, coluna: null, nivel: null }),
    ).toThrow(/impossível/);
  });
});

describe('saldo de nível', () => {
  const CASOS: readonly SaldoDeNivel[] = [
    { estado: 'lido', abertura: 1_100_000n, fechamento: 1_200_000n },
    // Primeiro período da série: abertura nula dentro de `lido` (D5).
    { estado: 'lido', abertura: null, fechamento: 1_200_000n },
    { estado: 'ausente' },
    { estado: 'indefinido', motivo: motivoDoNivel('nivel-nao-mapeado', 'PP') },
    { estado: 'indefinido', motivo: motivoDaConta('nivel-incompleto', '1.1.3.04', 'MP') },
  ];

  it.each(CASOS.map((c) => [c.estado, c] as const))('sobrevive à ida e volta: %s', (_nome, saldo) => {
    expect(saldoDeLinha(saldoParaLinha(saldo))).toEqual(saldo);
  });

  it('não confunde abertura nula de `lido` com a ausência de variante', () => {
    // As duas dão coluna nula; só o estado as separa. É o caso que o ADR-0008
    // nomeia como o agravante do `SaldoDeNivel`.
    const primeiroPeriodo = saldoParaLinha({ estado: 'lido', abertura: null, fechamento: 500n });
    const ausente = saldoParaLinha({ estado: 'ausente' });
    expect(primeiroPeriodo.abertura).toBeNull();
    expect(ausente.abertura).toBeNull();
    expect(saldoDeLinha(primeiroPeriodo).estado).toBe('lido');
    expect(saldoDeLinha(ausente).estado).toBe('ausente');
  });
});

describe('consumo e perda', () => {
  const CASOS: readonly ConsumoDeNivel[] = [
    { estado: 'lido', valor: 1_850_000n },
    { estado: 'lido', valor: 0n },
    {
      estado: 'indefinido',
      motivo: { codigo: 'contrapartida-ausente', ancora: { tipo: 'lancamento', conta: '1.1.3.01', linha: 42 } },
    },
  ];

  it.each(CASOS.map((c) => [c.estado, c] as const))('o consumo sobrevive à ida e volta: %s', (_nome, consumo) => {
    expect(consumoDeLinha(consumoParaLinha(consumo))).toEqual(consumo);
  });

  it('a perda não medida volta nula, e zero volta zero', () => {
    // D7: `naoMedido` nunca é 0%, e 0% medido nunca é `naoMedido`.
    expect(perdaDeLinha(perdaParaLinha(null))).toBeNull();
    expect(perdaDeLinha(perdaParaLinha(0n))).toBe(0n);
    expect(perdaParaLinha(null).estado).toBe('naoMedido');
    expect(perdaParaLinha(0n).estado).toBe('medido');
  });
});

describe('custo de materiais', () => {
  const CASOS: readonly CustoDeMateriais[] = [
    { origem: 'derivado', valor: 1_850_000n },
    { origem: 'informado', valor: 1_800_000n },
    { origem: 'indefinido', motivo: motivoDoNivel('sem-razao-nem-informado', 'MP') },
  ];

  it.each(CASOS.map((c) => [c.origem, c] as const))('sobrevive à ida e volta: %s', (_nome, custo) => {
    expect(custoMateriaisDeLinha(custoMateriaisParaLinha(custo))).toEqual(custo);
  });

  it('conferido não grava a divergência, e a recalcula igual na volta', () => {
    const custo: CustoDeMateriais = {
      origem: 'conferido',
      valor: 1_850_000n,
      informado: 1_600_000n,
      divergencia: 250_000 / 1_850_000,
    };
    const linha = custoMateriaisParaLinha(custo);
    expect(Object.keys(linha)).not.toContain('divergencia');

    const volta = custoMateriaisDeLinha(linha);
    if (volta.origem !== 'conferido') throw new Error('esperava conferido');
    expect(volta.divergencia).toBeCloseTo(custo.divergencia, 12);
  });
});
