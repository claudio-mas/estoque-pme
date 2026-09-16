/**
 * A série mostra cada estado com o nome dele, e nunca inventa número.
 *
 * O `dados` devolve `Lançamento`; aqui o motor roda por cima. O que se prende
 * é a tradução: nível ausente vira PME `ausente`, custo de materiais
 * indefinido vira PME de MP `indefinido` com o motivo do custo, consumo
 * indefinido vira perda `naoMedido`.
 */
import { describe, expect, it } from 'vitest';
import type { PeriodoLido } from '@estoque-pme/dados';
import type { Lancamento } from '@estoque-pme/motor-calculo';
import { motivoDoNivel } from '@estoque-pme/motor-calculo';
import { serieDe } from '../src/servidor/serie';

const AGOSTO = { ano: 2025, mes: 8 };

const lancamento: Lancamento = {
  competencia: AGOSTO,
  estoque: {
    MP: { estado: 'lido', abertura: 1_100_000n, fechamento: 1_200_000n },
    PP: { estado: 'ausente' },
    PA: { estado: 'lido', abertura: 1_385_000n, fechamento: 1_500_000n },
  },
  consumo: {
    MP: { estado: 'lido', valor: 1_850_000n },
    PP: { estado: 'indefinido', motivo: motivoDoNivel('sem-razao', 'PP') },
    PA: { estado: 'indefinido', motivo: motivoDoNivel('sem-razao', 'PA') },
  },
  perdas: { MP: 60_864n, PP: null, PA: null },
  cmv: 2_450_000n,
  receita: 3_800_000n,
  compras: 1_950_000n,
  custoMateriais: { origem: 'derivado', valor: 1_850_000n },
};

describe('série por período', () => {
  const [linha] = serieDe([{ estado: 'apurado', lancamento }]);
  if (linha === undefined || linha.estado !== 'apurado') throw new Error('esperava apurado');

  it('calcula o PME de MP sobre o custo de materiais e o de PA sobre o CMV', () => {
    expect(linha.pme.MP?.estado).toBe('calculado');
    expect(linha.pme.PA?.estado).toBe('calculado');
    if (linha.pme.MP?.estado !== 'calculado' || linha.pme.PA?.estado !== 'calculado') return;
    // 11.500 / 18.500 × 30 e 14.425 / 24.500 × 30.
    expect(linha.pme.MP.dias).toBeCloseTo(18.65, 2);
    expect(linha.pme.PA.dias).toBeCloseTo(17.66, 2);
  });

  it('PP declarado ausente sai ausente e não entra na cobertura', () => {
    expect(linha.pme.PP).toEqual({ estado: 'ausente' });
    expect(linha.cobertura?.estado).toBe('calculado');
    if (linha.cobertura?.estado !== 'calculado') return;
    expect(linha.cobertura.niveis).toEqual(['MP', 'PA']);
  });

  it('a perda de MP é medida; a de PA, sem consumo, é não medida — nunca zero', () => {
    expect(linha.perda.MP?.estado).toBe('medido');
    expect(linha.perda.PA).toEqual({ estado: 'naoMedido' });
  });

  it('custo de materiais indefinido deixa o PME de MP indefinido com o motivo do custo', () => {
    const semCusto: Lancamento = {
      ...lancamento,
      custoMateriais: { origem: 'indefinido', motivo: motivoDoNivel('sem-razao-nem-informado', 'MP') },
    };
    const [l] = serieDe([{ estado: 'apurado', lancamento: semCusto }]);
    if (l?.estado !== 'apurado') throw new Error('esperava apurado');
    expect(l.pme.MP?.estado).toBe('indefinido');
    if (l.pme.MP?.estado !== 'indefinido') return;
    expect(l.pme.MP.motivo.codigo).toBe('sem-razao-nem-informado');
    // E a cobertura cai junto: não se soma parcial.
    expect(l.cobertura?.estado).toBe('indefinido');
  });

  it('período só importado atravessa com nome, sem número', () => {
    const [l] = serieDe([{ estado: 'importado', competencia: AGOSTO }]);
    expect(l).toMatchObject({ estado: 'importado', competencia: AGOSTO, lancamento: null });
  });
});
