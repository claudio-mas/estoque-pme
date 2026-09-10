/**
 * Leitura do razão nos dois formatos que existem de verdade.
 *
 * Em bloco: cabeçalho de conta, saldo anterior, lançamentos, saldo atual.
 * Plano: código da conta repetido em coluna própria. Qual dos dois é detectado,
 * como o delimitador e o decimal já são — o cliente não sabe responder e não
 * deveria precisar.
 */
import { describe, expect, it } from 'vitest';
import { lerRazao } from '../src/index';
import type { ContaRazao, PerfilImportacao } from '../src/index';

const latin1 = (texto: string): Uint8Array =>
  Uint8Array.from([...texto].map((c) => c.charCodeAt(0)));

const arquivo = (linhas: readonly string[]): Uint8Array => latin1(linhas.join('\r\n'));

function porCodigo(contas: readonly ContaRazao[], codigo: string): ContaRazao {
  const encontrada = contas.find((conta) => conta.codigo === codigo);
  if (encontrada === undefined) throw new Error(`Conta ${codigo} não foi lida.`);
  return encontrada;
}

const EM_BLOCO = arquivo([
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
  'CONTA: 1.1.3.03 - PRODUTOS ACABADOS',
  'Saldo anterior;;;;;13.850,00',
  '31/08/2025;PRODUÇÃO DO MÊS;1.1.3.02;24.500,00;;38.350,00',
  '31/08/2025;CUSTO DAS VENDAS;4.1.1.01;;23.350,00;15.000,00',
  'Saldo atual;;;;;15.000,00',
]);

describe('razão em bloco', () => {
  const resultado = lerRazao(EM_BLOCO);

  it('detecta o formato em bloco quando não há coluna de conta', () => {
    expect(resultado.perfil?.razao?.delimitacao).toBe('bloco');
    expect(resultado.perfil?.razao?.colunas.conta).toBeNull();
    expect(resultado.perfil?.razao?.colunas.contrapartida).toBe(2);
  });

  it('acha a competência no preâmbulo, como o balancete', () => {
    expect(resultado.competencia).toEqual({ ano: 2025, mes: 8 });
  });

  it('agrupa por conta, com saldo anterior e atual do bloco', () => {
    const mp = porCodigo(resultado.contas, '1.1.3.01');
    expect(mp.descricao).toBe('MATÉRIAS-PRIMAS');
    expect(mp.saldoAnterior).toBe(1_100_000n);
    expect(mp.saldoAtual).toBe(1_200_000n);
    expect(mp.lancamentos).toHaveLength(3);
  });

  it('não lê a data do lançamento como código de conta', () => {
    expect(resultado.contas.map((conta) => conta.codigo)).toEqual(['1.1.3.01', '1.1.3.03']);
  });

  it('guarda data, histórico e contrapartida como rastro', () => {
    const [compra] = porCodigo(resultado.contas, '1.1.3.01').lancamentos;
    expect(compra?.data).toBe('05/08/2025');
    expect(compra?.historico).toBe('COMPRA NF 4471');
    expect(compra?.contrapartida).toBe('2.1.1.01');
    expect(compra?.debito).toBe(1_950_000n);
    expect(compra?.credito).toBe(0n);
  });

  it('o razão que fecha não gera erro', () => {
    expect(resultado.diagnosticos.filter((d) => d.severidade === 'erro')).toEqual([]);
  });
});

describe('integridade', () => {
  it('acusa a conta em que saldo anterior mais movimento não dá o saldo atual', () => {
    const torto = lerRazao(
      arquivo([
        'Período: 01/08/2025 a 31/08/2025',
        'Data;Histórico;Débito;Crédito;Saldo',
        'CONTA: 1.1.3.01 - MATÉRIAS-PRIMAS',
        'Saldo anterior;;;;11.000,00',
        '05/08/2025;COMPRA;19.500,00;;30.500,00',
        'Saldo atual;;;;12.000,00',
      ]),
    );
    const erros = torto.diagnosticos.filter((d) => d.severidade === 'erro');
    expect(erros.map((d) => d.codigo)).toContain('razao-nao-fecha');
  });

  it('não inventa saldo no formato plano, que não os traz', () => {
    const plano = lerRazao(
      arquivo([
        'Período: 01/08/2025 a 31/08/2025',
        'Conta;Data;Histórico;Contrapartida;Valor;D/C',
        '1.1.3.01;05/08/2025;COMPRA NF 4471;2.1.1.01;19.500,00;D',
        '1.1.3.01;18/08/2025;REQUISIÇÃO OP-220;1.1.3.02;17.891,36;C',
      ]),
    );
    const mp = porCodigo(plano.contas, '1.1.3.01');
    expect(mp.saldoAnterior).toBeNull();
    expect(mp.saldoAtual).toBeNull();
    expect(plano.diagnosticos.filter((d) => d.severidade === 'erro')).toEqual([]);
  });
});

describe('razão plano com valor e natureza', () => {
  const plano = lerRazao(
    arquivo([
      'Período: 01/08/2025 a 31/08/2025',
      'Conta;Data;Histórico;Contrapartida;Valor;D/C',
      '1.1.3.01;05/08/2025;COMPRA NF 4471;2.1.1.01;19.500,00;D',
      '1.1.3.01;18/08/2025;REQUISIÇÃO OP-220;1.1.3.02;17.891,36;C',
      '1.1.3.03;31/08/2025;PRODUÇÃO;1.1.3.02;24.500,00;D',
    ]),
  );

  it('detecta o formato plano pela coluna de conta', () => {
    expect(plano.perfil?.razao?.delimitacao).toBe('plano');
  });

  it('põe o valor do lado que a natureza D/C manda', () => {
    const [compra, requisicao] = porCodigo(plano.contas, '1.1.3.01').lancamentos;
    expect(compra?.debito).toBe(1_950_000n);
    expect(compra?.credito).toBe(0n);
    expect(requisicao?.debito).toBe(0n);
    expect(requisicao?.credito).toBe(1_789_136n);
  });

  it('separa as contas do arquivo plano', () => {
    expect(plano.contas.map((conta) => conta.codigo)).toEqual(['1.1.3.01', '1.1.3.03']);
  });
});

describe('perfil de importação (RF-24)', () => {
  it('o layout detectado num arquivo lê o do mês seguinte sem redetectar nada', () => {
    const primeiro = lerRazao(EM_BLOCO);
    const perfil = primeiro.perfil as PerfilImportacao;

    const setembro = lerRazao(
      latin1(
        [...EM_BLOCO]
          .map((byte) => String.fromCharCode(byte))
          .join('')
          .replace('01/08/2025 a 31/08/2025', '01/09/2025 a 30/09/2025'),
      ),
      { perfil },
    );

    expect(setembro.competencia).toEqual({ ano: 2025, mes: 9 });
    expect(setembro.perfil?.razao).toEqual(perfil.razao);
  });

  it('perfil que só conhece o balancete não atrapalha: o dialeto vale, o layout não', () => {
    const soBalancete: PerfilImportacao = {
      dialeto: { codificacao: 'windows-1252', delimitador: ';', separadorDecimal: ',' },
      balancete: {
        linhaCabecalho: 5,
        colunas: {
          codigo: 0,
          descricao: 1,
          saldoAnterior: 2,
          debito: 3,
          credito: 4,
          saldoAtual: 5,
        },
      },
      razao: null,
    };
    const resultado = lerRazao(EM_BLOCO, { perfil: soBalancete });
    expect(porCodigo(resultado.contas, '1.1.3.01').saldoAtual).toBe(1_200_000n);
  });
});

describe('arquivo que não é razão', () => {
  it('não acha colunas de valor e diz isso, sem lançar', () => {
    const resultado = lerRazao(arquivo(['relatório qualquer', 'Nome;Endereço;Telefone']));
    expect(resultado.contas).toEqual([]);
    expect(resultado.diagnosticos.map((d) => d.codigo)).toContain(
      'cabecalho-de-razao-nao-encontrado',
    );
  });
});
