/**
 * O caminho inteiro, uma vez: bytes Latin-1 → parser → mapeamento → PME.
 *
 * Os testes de unidade constroem `LinhaBalancete` à mão, e é justamente por
 * isso que este existe: o erro caro aqui é o mapeamento funcionando contra
 * objetos que o teste inventou e falhando contra o que o parser produz de
 * verdade — sinal contábil já aplicado, `sintetica` calculada, saldo `null`
 * onde o teste teria posto `0n`. Um teste que atravessa os três pacotes com
 * bytes reais é o que mataria isso, e um basta.
 *
 * A fixture é própria, não importada do importador: quem mexer na fixture de lá
 * não deve quebrar este pacote sem entender por quê.
 */
import { describe, expect, it } from 'vitest';
import { lerBalancete, lerRazao } from '@estoque-pme/importador';
import { calcularPme, cobertura, perdaMedida } from '@estoque-pme/motor-calculo';
import type { Pme } from '@estoque-pme/motor-calculo';
import { aplicarMapeamento } from '../src/index';
import type { EntradaDeMapeamento, Mapeamento } from '../src/index';

const latin1 = (texto: string): Uint8Array =>
  Uint8Array.from([...texto].map((c) => c.charCodeAt(0)));

const BALANCETE = latin1(
  [
    'BALANCETE DE VERIFICAÇÃO',
    'Alimentos Boa Safra Ltda',
    'Período: 01/08/2025 a 31/08/2025',
    '',
    'Classificação;Descrição;Saldo Anterior;Débito;Crédito;Saldo Atual',
    '1;ATIVO;45.000,00;0,00;0,00;48.500,00',
    '1.1;ATIVO CIRCULANTE;45.000,00;0,00;0,00;48.500,00',
    '1.1.1;DISPONÍVEL;15.650,00;0,00;0,00;16.500,00',
    '1.1.3;ESTOQUES;29.350,00;49.200,00;46.550,00;32.000,00',
    '1.1.3.01;MATÉRIAS-PRIMAS;11.000,00;19.500,00;18.500,00;12.000,00',
    '1.1.3.02;PRODUTOS EM PROCESSO;4.500,00;5.200,00;4.700,00;5.000,00',
    '1.1.3.03;PRODUTOS ACABADOS;13.850,00;24.500,00;23.350,00;15.000,00',
    '1.1.3.09;PERDAS E QUEBRAS DE MATÉRIA-PRIMA;0,00;608,64;0,00;608,64',
    '3.1.1.01;RECEITA DE VENDAS;0,00;0,00;38.000,00;38.000,00 C',
    '4.1.1.01;CUSTO DAS MERCADORIAS VENDIDAS;0,00;24.500,00;0,00;24.500,00 D',
    ';TOTAL DO ATIVO;45.000,00;;;48.500,00',
  ].join('\r\n'),
);

/**
 * O razão da conta de MP do mesmo período, e ele **fecha** contra o balancete:
 * 11.000 + 19.500 − 18.500 = 12.000, que é o saldo atual lá.
 */
const RAZAO = latin1(
  [
    'RAZÃO ANALÍTICO',
    'Alimentos Boa Safra Ltda',
    'Período: 01/08/2025 a 31/08/2025',
    '',
    'Data;Histórico;Contrapartida;Débito;Crédito;Saldo',
    'CONTA: 1.1.3.01 - MATÉRIAS-PRIMAS',
    'Saldo anterior;;;;;11.000,00',
    '05/08/2025;COMPRA NF 4471;2.1.1.01;19.500,00;;30.500,00',
    '18/08/2025;REQUISIÇÃO OP-220;1.1.3.02;;17.891,36;12.608,64',
    '31/08/2025;QUEBRA DE ESTOQUE;1.1.3.09;;608,64;12.000,00',
    'Saldo atual;;;;;12.000,00',
  ].join('\r\n'),
);

const entrada = (
  codigo: string,
  descricao: string,
  decisao: EntradaDeMapeamento['decisao'],
): EntradaDeMapeamento => ({ codigo, descricao, decisao });

const MAPEAMENTO: Mapeamento = {
  entradas: [
    entrada('1.1.1', 'DISPONÍVEL', { estado: 'ignorada' }),
    entrada('1.1.3.01', 'MATÉRIAS-PRIMAS', {
      estado: 'classificada',
      papel: { papel: 'estoque', nivel: 'MP' },
    }),
    entrada('1.1.3.02', 'PRODUTOS EM PROCESSO', {
      estado: 'classificada',
      papel: { papel: 'estoque', nivel: 'PP' },
    }),
    entrada('1.1.3.03', 'PRODUTOS ACABADOS', {
      estado: 'classificada',
      papel: { papel: 'estoque', nivel: 'PA' },
    }),
    entrada('1.1.3.09', 'PERDAS E QUEBRAS DE MATÉRIA-PRIMA', {
      estado: 'classificada',
      papel: { papel: 'baixa', nivel: 'MP' },
    }),
    entrada('3.1.1.01', 'RECEITA DE VENDAS', {
      estado: 'classificada',
      papel: { papel: 'receita' },
    }),
    entrada('4.1.1.01', 'CUSTO DAS MERCADORIAS VENDIDAS', {
      estado: 'classificada',
      papel: { papel: 'cmv' },
    }),
  ],
  niveisAusentes: [],
};

describe('do arquivo ao PME', () => {
  const balancete = lerBalancete(BALANCETE);
  const resultado = aplicarMapeamento(MAPEAMENTO, balancete);

  it('lê o arquivo sem sobrar pendência', () => {
    expect(resultado.pendentes).toEqual([]);
  });

  it('não produz erro de mapeamento num balancete inteiro e mapeado', () => {
    expect(resultado.diagnosticos.filter((d) => d.severidade === 'erro')).toEqual([]);
  });

  it('conta a analítica e não a sintética: 12.000 de MP, não 32.000 de estoques', () => {
    const lancamento = resultado.lancamento;
    if (lancamento === null) throw new Error('esperava lançamento');
    expect(lancamento.estoque.MP).toEqual({
      estado: 'lido',
      abertura: 1_100_000n,
      fechamento: 1_200_000n,
    });
  });

  it('traz CMV pelo movimento e receita com o sinal normalizado', () => {
    expect(resultado.lancamento?.cmv).toBe(2_450_000n);
    expect(resultado.lancamento?.receita).toBe(3_800_000n);
  });

  it('mede a perda de MP e deixa PP e PA sem medição, nunca em zero', () => {
    expect(resultado.lancamento?.perdas.MP).toBe(60_864n);
    expect(resultado.lancamento?.perdas.PP).toBeNull();
    expect(resultado.lancamento?.perdas.PA).toBeNull();
  });

  it('alimenta o motor: PME de PA sobre o estoque médio', () => {
    const lancamento = resultado.lancamento;
    if (lancamento === null) throw new Error('esperava lançamento');
    const pa = lancamento.estoque.PA;
    if (pa.estado !== 'lido') throw new Error('esperava PA lido');

    const pme = calcularPme({
      estoqueAbertura: pa.abertura,
      estoqueFechamento: pa.fechamento,
      custoDirecionador: lancamento.cmv ?? 0n,
    });

    expect(pme.estado).toBe('calculado');
    if (pme.estado !== 'calculado') throw new Error('esperava PME calculado');
    expect(pme.base).toBe('medio');
    expect(pme.dias).toBeCloseTo(17.66, 2);
  });

  it('com o razão, deriva consumo e compras, e o custo de materiais sai do arquivo', () => {
    const comRazao = aplicarMapeamento(MAPEAMENTO, balancete, { razao: lerRazao(RAZAO) });
    const lancamento = comRazao.lancamento;
    if (lancamento === null) throw new Error('esperava lançamento');

    // 17.891,36 para PP mais 608,64 de quebra: a perda **fica** dentro do
    // consumo, que é o que a D7 exige.
    expect(lancamento.consumo.MP).toEqual({ estado: 'lido', valor: 1_850_000n });
    expect(lancamento.compras).toBe(1_950_000n);
    expect(lancamento.custoMateriais).toEqual({ origem: 'derivado', valor: 1_850_000n });
    expect(comRazao.diagnosticos.filter((d) => d.severidade === 'erro')).toEqual([]);
  });

  it('o razão só de MP não inventa consumo para PP e PA', () => {
    const comRazao = aplicarMapeamento(MAPEAMENTO, balancete, { razao: lerRazao(RAZAO) });
    expect(comRazao.lancamento?.consumo.PP.estado).toBe('indefinido');
    expect(comRazao.lancamento?.consumo.PA.estado).toBe('indefinido');
  });

  it('fecha a fração da perda: numerador do balancete, denominador do razão', () => {
    const comRazao = aplicarMapeamento(MAPEAMENTO, balancete, { razao: lerRazao(RAZAO) });
    const lancamento = comRazao.lancamento;
    if (lancamento === null) throw new Error('esperava lançamento');
    const consumo = lancamento.consumo.MP;
    if (consumo.estado !== 'lido') throw new Error('esperava consumo lido');

    const perda = perdaMedida(lancamento.perdas.MP, consumo.valor);
    expect(perda.estado).toBe('medido');
    if (perda.estado !== 'medido') throw new Error('esperava perda medida');
    expect(perda.taxa).toBeCloseTo(0.0329, 4);
  });

  it('a cobertura soma PP porque esta empresa o movimenta', () => {
    const lancamento = resultado.lancamento;
    if (lancamento === null) throw new Error('esperava lançamento');

    const pmeDe = (nivel: 'MP' | 'PP' | 'PA', custo: bigint): Pme => {
      const saldo = lancamento.estoque[nivel];
      if (saldo.estado === 'ausente') return { estado: 'ausente' };
      if (saldo.estado === 'indefinido') return { estado: 'indefinido', motivo: saldo.motivo };
      return calcularPme({
        estoqueAbertura: saldo.abertura,
        estoqueFechamento: saldo.fechamento,
        custoDirecionador: custo,
      });
    };

    const cmv = lancamento.cmv ?? 0n;
    const total = cobertura({ PP: pmeDe('PP', cmv), PA: pmeDe('PA', cmv) });
    expect(total.estado).toBe('calculado');
    if (total.estado !== 'calculado') throw new Error('esperava cobertura');
    expect(total.niveis).toEqual(['PP', 'PA']);
  });
});
