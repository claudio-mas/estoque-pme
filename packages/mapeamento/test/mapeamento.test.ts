/**
 * As regras do mapeamento, contra contas construídas à mão.
 *
 * O caminho de ponta a ponta — bytes de verdade, parser de verdade — está em
 * `integracao.test.ts`: é lá que se pega o mapeamento funcionando contra
 * objetos que o teste inventou e falhando contra o que o parser produz.
 */
import { describe, expect, it } from 'vitest';
import type { LinhaBalancete } from '@estoque-pme/importador';
import {
  aplicarMapeamento,
  descendeDe,
  proporMapeamento,
  sugerirPapel,
  topos,
  validarMapeamento,
} from '../src/index';
import type { EntradaDeMapeamento, Mapeamento } from '../src/index';

function conta(
  codigo: string,
  descricao: string,
  campos: Partial<LinhaBalancete> = {},
): LinhaBalancete {
  return {
    linha: 1,
    codigo,
    descricao,
    saldoAnterior: 0n,
    debito: 0n,
    credito: 0n,
    saldoAtual: 0n,
    grau: codigo.split('.').length,
    sintetica: false,
    ...campos,
  };
}

function montar(entradas: readonly EntradaDeMapeamento[], niveisAusentes: Mapeamento['niveisAusentes'] = []): Mapeamento {
  return { entradas, niveisAusentes };
}

const MP: EntradaDeMapeamento = {
  codigo: '1.1.3.01',
  descricao: 'MATÉRIAS-PRIMAS',
  decisao: { estado: 'classificada', papel: { papel: 'estoque', nivel: 'MP' } },
};
const PA: EntradaDeMapeamento = {
  codigo: '1.1.3.03',
  descricao: 'PRODUTOS ACABADOS',
  decisao: { estado: 'classificada', papel: { papel: 'estoque', nivel: 'PA' } },
};
const CMV: EntradaDeMapeamento = {
  codigo: '4.1.1.01',
  descricao: 'CMV',
  decisao: { estado: 'classificada', papel: { papel: 'cmv' } },
};
const RECEITA: EntradaDeMapeamento = {
  codigo: '3.1.1.01',
  descricao: 'RECEITA DE VENDAS',
  decisao: { estado: 'classificada', papel: { papel: 'receita' } },
};

const BASE = montar([MP, PA, CMV, RECEITA], ['PP']);

describe('posse de subárvore', () => {
  it('não confunde 1.1.30 com filha de 1.1.3', () => {
    expect(descendeDe('1.1.3.01', '1.1.3')).toBe(true);
    expect(descendeDe('1.1.30', '1.1.3')).toBe(false);
  });

  it('fica só com os topos, para não somar sintética com analítica', () => {
    expect(topos(['1.1.3', '1.1.3.01', '1.1.3.02'])).toEqual(['1.1.3']);
    expect(topos(['1.1.3.01', '1.1.3.02'])).toEqual(['1.1.3.01', '1.1.3.02']);
  });

  it('recusa mapear conta que desce de outra já mapeada', () => {
    const mapeamento = montar(
      [
        { ...MP, codigo: '1.1.3' },
        MP,
        CMV,
      ],
      ['PP'],
    );
    const erros = validarMapeamento(mapeamento).filter((d) => d.severidade === 'erro');
    expect(erros.map((d) => d.codigo)).toContain('sobreposicao-de-subarvore');
  });
});

describe('léxico', () => {
  it('propõe pelo nome e pelo código juntos, dizendo o motivo', () => {
    const sugestao = sugerirPapel('1.1.3.01', 'MATÉRIAS-PRIMAS');
    expect(sugestao.estado).toBe('sugerido');
    if (sugestao.estado !== 'sugerido') throw new Error('esperava sugestão');
    expect(sugestao.papel).toEqual({ papel: 'estoque', nivel: 'MP' });
    expect(sugestao.motivo).toContain('materias primas');
    expect(sugestao.motivo).toContain('1.1.3.01');
  });

  it('põe baixa acima de estoque quando a descrição casa com os dois', () => {
    const sugestao = sugerirPapel('1.1.3.09', 'PERDAS DE MATÉRIA-PRIMA');
    if (sugestao.estado !== 'sugerido') throw new Error('esperava sugestão');
    expect(sugestao.papel).toEqual({ papel: 'baixa', nivel: 'MP' });
  });

  it('não escolhe o nível de uma baixa que não diz o nível', () => {
    expect(sugerirPapel('4.1.9.01', 'PERDAS E QUEBRAS').estado).toBe('semSugestao');
  });

  it('não propõe quando descrição e código se contradizem, e diz por quê', () => {
    const sugestao = sugerirPapel('2.1.1.05', 'MATÉRIAS-PRIMAS A PAGAR');
    expect(sugestao.estado).toBe('incoerente');
    if (sugestao.estado !== 'incoerente') throw new Error('esperava incoerência');
    expect(sugestao.motivo).toContain('grupo 2');
  });

  it('casa sigla como palavra, não como pedaço de palavra', () => {
    expect(sugerirPapel('2.1.1.01', 'PAGAMENTOS A FORNECEDORES').estado).toBe('semSugestao');
    expect(sugerirPapel('1.1.4.01', 'IMPORTAÇÕES EM ANDAMENTO').estado).toBe('semSugestao');
  });

  it('não confunde conta sobre vendas com a conta de receita', () => {
    expect(sugerirPapel('4.1.5.01', 'IMPOSTOS SOBRE VENDAS').estado).toBe('semSugestao');
    expect(sugerirPapel('4.2.1.01', 'DESPESAS COM VENDAS').estado).toBe('semSugestao');
    expect(sugerirPapel('3.1.1.01', 'RECEITA DE VENDAS').estado).toBe('sugerido');
  });
});

describe('contas pendentes', () => {
  const linhas = [
    conta('1', 'ATIVO'),
    conta('1.1', 'ATIVO CIRCULANTE'),
    conta('1.1.3', 'ESTOQUES'),
    conta('1.1.3.01', 'MATÉRIAS-PRIMAS'),
    conta('1.1.3.04', 'INSUMOS DIVERSOS'),
    conta('1.1.1.01', 'CAIXA'),
  ];

  it('sintética com descendente já decidido não fica pendente para sempre', () => {
    const pendentes = proporMapeamento(linhas, montar([MP]));
    expect(pendentes.map((p) => p.codigo)).not.toContain('1.1.3');
    expect(pendentes.map((p) => p.codigo)).not.toContain('1');
  });

  it('ignorar uma conta leva a subárvore junto', () => {
    const ignorada: EntradaDeMapeamento = {
      codigo: '1.1.1',
      descricao: 'DISPONÍVEL',
      decisao: { estado: 'ignorada' },
    };
    const pendentes = proporMapeamento(linhas, montar([MP, ignorada]));
    expect(pendentes.map((p) => p.codigo)).toEqual(['1.1.3.04']);
  });
});

describe('obrigatoriedade', () => {
  it('MP sem conta e sem declaração de ausência é erro', () => {
    const erros = validarMapeamento(montar([PA, CMV])).filter((d) => d.severidade === 'erro');
    expect(erros.map((d) => d.codigo)).toContain('mp-nao-mapeada');
  });

  it('CMV sem conta é erro: é o direcionador de custo de PP e de PA', () => {
    const erros = validarMapeamento(montar([MP], ['PP'])).filter((d) => d.severidade === 'erro');
    expect(erros.map((d) => d.codigo)).toContain('cmv-nao-mapeado');
  });

  it('receita sem conta é aviso, não erro', () => {
    const diagnosticos = validarMapeamento(montar([MP, CMV], ['PP']));
    expect(diagnosticos.filter((d) => d.severidade === 'erro')).toEqual([]);
    expect(diagnosticos.map((d) => d.codigo)).toContain('receita-nao-mapeada');
  });

  it('nível declarado ausente e mapeado ao mesmo tempo é contradição', () => {
    const erros = validarMapeamento(montar([MP, PA, CMV], ['PA'])).filter(
      (d) => d.severidade === 'erro',
    );
    expect(erros.map((d) => d.codigo)).toContain('nivel-ausente-e-mapeado');
  });
});

describe('aplicação', () => {
  const competencia = { ano: 2025, mes: 8 };
  const perfil = {
    dialeto: {
      formato: 'delimitado',
      codificacao: 'utf-8',
      delimitador: ';',
      separadorDecimal: ',',
    },
    balancete: {
      linhaCabecalho: 0,
      colunas: { codigo: 0, descricao: 1, saldoAnterior: 2, debito: 3, credito: 4, saldoAtual: 5 },
    },
    razao: null,
  } as const;

  const balancete = (linhas: readonly LinhaBalancete[]) => ({
    competencia,
    linhas,
    diagnosticos: [],
    perfil,
  });

  const LINHAS = [
    conta('1.1.3.01', 'MATÉRIAS-PRIMAS', { saldoAnterior: 1_100_000n, saldoAtual: 1_200_000n }),
    conta('1.1.3.03', 'PRODUTOS ACABADOS', { saldoAnterior: 1_385_000n, saldoAtual: 1_500_000n }),
    conta('4.1.1.01', 'CMV', { debito: 2_450_000n, saldoAtual: 2_450_000n }),
    conta('3.1.1.01', 'RECEITA DE VENDAS', { credito: 3_800_000n, saldoAtual: -3_800_000n }),
  ];

  it('resolve o balancete em lançamento, com PP declarado ausente', () => {
    const { lancamento } = aplicarMapeamento(BASE, balancete(LINHAS));
    if (lancamento === null) throw new Error('esperava lançamento');

    expect(lancamento.estoque.MP).toEqual({
      estado: 'lido',
      abertura: 1_100_000n,
      fechamento: 1_200_000n,
    });
    expect(lancamento.estoque.PP).toEqual({ estado: 'ausente' });
    expect(lancamento.cmv).toBe(2_450_000n);
    expect(lancamento.perdas.MP).toBeNull();
  });

  it('normaliza o sinal da receita, que chega credora e portanto negativa', () => {
    const { lancamento } = aplicarMapeamento(BASE, balancete(LINHAS));
    expect(lancamento?.receita).toBe(3_800_000n);
  });

  it('lê conta de resultado pelo movimento, não pelo saldo acumulado do exercício', () => {
    const acumulador = LINHAS.map((linha) =>
      linha.codigo === '4.1.1.01'
        ? { ...linha, saldoAnterior: 20_000_000n, saldoAtual: 22_450_000n }
        : linha,
    );
    const { lancamento } = aplicarMapeamento(BASE, balancete(acumulador));
    expect(lancamento?.cmv).toBe(2_450_000n);
  });

  it('soma as analíticas quando o ERP não exportou a sintética mapeada', () => {
    const mapeamento = montar([{ ...MP, codigo: '1.1.3', descricao: 'ESTOQUES' }, CMV], [
      'PP',
      'PA',
    ]);
    const linhas = [
      conta('1.1.3.01', 'MATÉRIAS-PRIMAS', { saldoAnterior: 1_100_000n, saldoAtual: 1_200_000n }),
      conta('1.1.3.02', 'EMBALAGENS', { saldoAnterior: 400_000n, saldoAtual: 300_000n }),
      conta('4.1.1.01', 'CMV', { debito: 2_450_000n, saldoAtual: 2_450_000n }),
    ];
    const { lancamento } = aplicarMapeamento(mapeamento, balancete(linhas));
    expect(lancamento?.estoque.MP).toEqual({
      estado: 'lido',
      abertura: 1_500_000n,
      fechamento: 1_500_000n,
    });
  });

  it('conta pendente no grupo do estoque deixa o nível indefinido, nunca ausente', () => {
    const comPendente = [
      ...LINHAS,
      conta('1.1.3.04', 'INSUMOS DIVERSOS', { saldoAtual: 800_000n }),
    ];
    const { lancamento } = aplicarMapeamento(BASE, balancete(comPendente));
    expect(lancamento?.estoque.MP.estado).toBe('indefinido');
    expect(lancamento?.estoque.PP).toEqual({ estado: 'ausente' });
  });

  it('avisa quando a descrição do arquivo não bate com a guardada', () => {
    const renomeada = LINHAS.map((linha) =>
      linha.codigo === '1.1.3.01' ? { ...linha, descricao: 'ADIANTAMENTO A FORNECEDORES' } : linha,
    );
    const { diagnosticos } = aplicarMapeamento(BASE, balancete(renomeada));
    expect(diagnosticos.map((d) => d.codigo)).toContain('descricao-divergente');
  });

  it('não produz lançamento quando o mapeamento tem erro', () => {
    const { lancamento, diagnosticos } = aplicarMapeamento(montar([PA, CMV]), balancete(LINHAS));
    expect(lancamento).toBeNull();
    expect(diagnosticos.some((d) => d.severidade === 'erro')).toBe(true);
  });
});
