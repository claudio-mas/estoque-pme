/**
 * Quais créditos são consumo, e o que acontece quando não dá para saber.
 *
 * O ADR-0004 explica por que a derivação do RF-29 é só uma soma de créditos; o
 * que estes testes prendem é a parte que sobrou: a classificação pela
 * contrapartida, e a recusa a derivar quando ela falta.
 */
import { describe, expect, it } from 'vitest';
import type { ContaRazao, LancamentoRazao, ResultadoRazao } from '@estoque-pme/importador';
import { aplicarMapeamento } from '../src/index';
import type { EntradaDeMapeamento, Mapeamento } from '../src/index';

const COMPETENCIA = { ano: 2025, mes: 8 } as const;

const classificada = (
  codigo: string,
  descricao: string,
  papel: Extract<EntradaDeMapeamento['decisao'], { estado: 'classificada' }>['papel'],
): EntradaDeMapeamento => ({
  codigo,
  descricao,
  decisao: { estado: 'classificada', papel },
});

const MAPEAMENTO: Mapeamento = {
  entradas: [
    classificada('1.1.3.01', 'MATÉRIAS-PRIMAS', { papel: 'estoque', nivel: 'MP' }),
    classificada('1.1.3.02', 'PRODUTOS EM PROCESSO', { papel: 'estoque', nivel: 'PP' }),
    classificada('1.1.3.09', 'QUEBRAS DE MP', { papel: 'baixa', nivel: 'MP' }),
    classificada('4.1.1.01', 'CMV', { papel: 'cmv' }),
    { codigo: '2.1.1', descricao: 'FORNECEDORES', decisao: { estado: 'ignorada' } },
  ],
  niveisAusentes: ['PA'],
};

function lancamento(campos: Partial<LancamentoRazao>): LancamentoRazao {
  return {
    linha: 10,
    data: '15/08/2025',
    historico: 'LANÇAMENTO',
    debito: 0n,
    credito: 0n,
    contrapartida: null,
    ...campos,
  };
}

function razaoDeMp(lancamentos: readonly LancamentoRazao[]): ResultadoRazao {
  const conta: ContaRazao = {
    codigo: '1.1.3.01',
    descricao: 'MATÉRIAS-PRIMAS',
    saldoAnterior: null,
    saldoAtual: null,
    lancamentos,
  };
  return { competencia: COMPETENCIA, contas: [conta], diagnosticos: [], perfil: null };
}

const BALANCETE = {
  competencia: COMPETENCIA,
  linhas: [
    {
      linha: 1,
      codigo: '1.1.3.01',
      descricao: 'MATÉRIAS-PRIMAS',
      saldoAnterior: 1_100_000n,
      debito: 0n,
      credito: 0n,
      saldoAtual: 1_200_000n,
      grau: 4,
      sintetica: false,
    },
    {
      linha: 2,
      codigo: '1.1.3.02',
      descricao: 'PRODUTOS EM PROCESSO',
      saldoAnterior: 450_000n,
      debito: 0n,
      credito: 0n,
      saldoAtual: 500_000n,
      grau: 4,
      sintetica: false,
    },
    {
      linha: 3,
      codigo: '4.1.1.01',
      descricao: 'CMV',
      saldoAnterior: 0n,
      debito: 2_450_000n,
      credito: 0n,
      saldoAtual: 2_450_000n,
      grau: 4,
      sintetica: false,
    },
  ],
  diagnosticos: [],
  perfil: null,
} as const;

const aplicar = (razao: ResultadoRazao | undefined, extras = {}) =>
  aplicarMapeamento(MAPEAMENTO, BALANCETE, { ...(razao ? { razao } : {}), ...extras });

describe('quais créditos são consumo', () => {
  it('crédito contra outro nível de estoque é o consumo em si', () => {
    const { lancamento: resultado } = aplicar(
      razaoDeMp([lancamento({ credito: 1_789_136n, contrapartida: '1.1.3.02' })]),
    );
    expect(resultado?.consumo.MP).toEqual({ estado: 'lido', valor: 1_789_136n });
  });

  it('crédito contra conta de baixa continua dentro do consumo (D7)', () => {
    const { lancamento: resultado } = aplicar(
      razaoDeMp([
        lancamento({ credito: 1_789_136n, contrapartida: '1.1.3.02' }),
        lancamento({ credito: 60_864n, contrapartida: '1.1.3.09' }),
      ]),
    );
    expect(resultado?.consumo.MP).toEqual({ estado: 'lido', valor: 1_850_000n });
  });

  it('transferência dentro do mesmo nível não sai do nível', () => {
    const comInterna: Mapeamento = {
      ...MAPEAMENTO,
      entradas: [
        ...MAPEAMENTO.entradas,
        classificada('1.1.3.05', 'MP EM PODER DE TERCEIROS', { papel: 'estoque', nivel: 'MP' }),
      ],
    };
    const resultado = aplicarMapeamento(comInterna, BALANCETE, {
      razao: razaoDeMp([lancamento({ credito: 500_000n, contrapartida: '1.1.3.05' })]),
    });
    expect(resultado.lancamento?.consumo.MP).toEqual({ estado: 'lido', valor: 0n });
  });

  it('devolução a fornecedor não é consumo', () => {
    const { lancamento: resultado } = aplicar(
      razaoDeMp([
        lancamento({ credito: 1_789_136n, contrapartida: '1.1.3.02' }),
        lancamento({ credito: 200_000n, contrapartida: '2.1.1.01' }),
      ]),
    );
    expect(resultado?.consumo.MP).toEqual({ estado: 'lido', valor: 1_789_136n });
  });
});

describe('quando não dá para saber', () => {
  it('lançamento sem contrapartida deixa o consumo indefinido, não aproximado', () => {
    const { lancamento: resultado, diagnosticos } = aplicar(
      razaoDeMp([lancamento({ credito: 1_789_136n, contrapartida: null })]),
    );
    expect(resultado?.consumo.MP.estado).toBe('indefinido');
    expect(diagnosticos.map((d) => d.codigo)).toContain('contrapartida-ausente');
  });

  it('contrapartida não mapeada também: pode ser perda ou fornecedor', () => {
    const { lancamento: resultado, diagnosticos } = aplicar(
      razaoDeMp([lancamento({ credito: 1_789_136n, contrapartida: '9.9.9.99' })]),
    );
    expect(resultado?.consumo.MP.estado).toBe('indefinido');
    expect(diagnosticos.map((d) => d.codigo)).toContain('contrapartida-pendente');
  });

  it('sem razão nenhuma, o consumo de todo nível é indefinido', () => {
    const { lancamento: resultado } = aplicar(undefined);
    expect(resultado?.consumo.MP.estado).toBe('indefinido');
    expect(resultado?.consumo.PA.estado).toBe('indefinido');
  });

  it('razão de outra competência é erro, e não produz lançamento', () => {
    const outro: ResultadoRazao = {
      ...razaoDeMp([lancamento({ credito: 1n, contrapartida: '1.1.3.02' })]),
      competencia: { ano: 2025, mes: 7 },
    };
    const resultado = aplicar(outro);
    expect(resultado.lancamento).toBeNull();
    expect(resultado.diagnosticos.map((d) => d.codigo)).toContain('competencias-diferentes');
  });
});

describe('compras de MP', () => {
  it('débito que não vem de estoque é compra, mesmo sem contrapartida', () => {
    const { lancamento: resultado } = aplicar(
      razaoDeMp([
        lancamento({ debito: 1_950_000n, contrapartida: '2.1.1.01' }),
        lancamento({ debito: 100_000n, contrapartida: null }),
        lancamento({ debito: 300_000n, contrapartida: '1.1.3.02' }),
      ]),
    );
    expect(resultado?.compras).toBe(2_050_000n);
  });
});

describe('custo de materiais (RF-29)', () => {
  const razao = razaoDeMp([lancamento({ credito: 1_850_000n, contrapartida: '1.1.3.02' })]);

  it('derivado do razão quando só ele existe', () => {
    expect(aplicar(razao).lancamento?.custoMateriais).toEqual({
      origem: 'derivado',
      valor: 1_850_000n,
    });
  });

  it('digitado sem razão carrega aviso permanente', () => {
    const { lancamento: resultado, diagnosticos } = aplicar(undefined, {
      custoMateriaisInformado: 1_800_000n,
    });
    expect(resultado?.custoMateriais).toEqual({ origem: 'informado', valor: 1_800_000n });
    expect(diagnosticos.map((d) => d.codigo)).toContain('custo-materiais-digitado');
  });

  it('com os dois, prevalece o derivado e a divergência fica à vista', () => {
    const { lancamento: resultado, diagnosticos } = aplicar(razao, {
      custoMateriaisInformado: 1_600_000n,
    });
    const custo = resultado?.custoMateriais;
    expect(custo?.origem).toBe('conferido');
    if (custo?.origem !== 'conferido') throw new Error('esperava conferido');
    expect(custo.valor).toBe(1_850_000n);
    expect(custo.informado).toBe(1_600_000n);
    expect(custo.divergencia).toBeCloseTo(0.135, 3);
    expect(diagnosticos.map((d) => d.codigo)).toContain('custo-materiais-divergente');
  });

  it('divergência dentro do limite não avisa', () => {
    const { diagnosticos } = aplicar(razao, { custoMateriaisInformado: 1_840_000n });
    expect(diagnosticos.map((d) => d.codigo)).not.toContain('custo-materiais-divergente');
  });

  it('sem razão e sem valor digitado, indefinido com motivo', () => {
    const custo = aplicar(undefined).lancamento?.custoMateriais;
    expect(custo?.origem).toBe('indefinido');
  });
});

describe('o motivo é navegável', () => {
  it('a contrapartida ausente aponta a conta e a linha, não uma frase', () => {
    const { lancamento: resultado } = aplicar(
      razaoDeMp([lancamento({ linha: 42, credito: 1_789_136n, contrapartida: null })]),
    );
    const consumo = resultado?.consumo.MP;
    expect(consumo?.estado).toBe('indefinido');
    if (consumo?.estado !== 'indefinido') throw new Error('esperava indefinido');
    // É o que o RF-29 pede por "aviso navegável": a conta num campo, não dentro
    // de uma string que ninguém consegue linkar.
    expect(consumo.motivo).toEqual({
      codigo: 'contrapartida-ausente',
      ancora: { tipo: 'lancamento', conta: '1.1.3.01', linha: 42 },
    });
  });

  it('sem razão, o motivo aponta o nível', () => {
    const consumo = aplicar(undefined).lancamento?.consumo.PP;
    if (consumo?.estado !== 'indefinido') throw new Error('esperava indefinido');
    expect(consumo.motivo).toEqual({
      codigo: 'sem-razao',
      ancora: { tipo: 'nivel', nivel: 'PP' },
    });
  });
});
