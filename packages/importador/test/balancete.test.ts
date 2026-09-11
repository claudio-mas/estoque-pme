/**
 * Leitura de um balancete inteiro, no formato em que ele realmente chega:
 * Latin-1, ponto e vírgula, preâmbulo antes do cabeçalho, cabeçalho repetido na
 * quebra de página, linha de total no fim e uma linha podre no meio.
 */
import { describe, expect, it } from 'vitest';
import { lerBalancete } from '../src/index';
import type { LinhaBalancete, PerfilImportacao } from '../src/index';

const latin1 = (texto: string): Uint8Array =>
  Uint8Array.from([...texto].map((c) => c.charCodeAt(0)));

const CABECALHO = 'Classificação;Descrição;Saldo Anterior;Débito;Crédito;Saldo Atual';

const BALANCETE = [
  'BALANCETE DE VERIFICAÇÃO',
  'Alimentos Boa Safra Ltda',
  'CNPJ: 12.345.678/0001-90',
  'Período: 01/08/2025 a 31/08/2025',
  '',
  CABECALHO,
  '1;ATIVO;45.000,00;0,00;0,00;48.500,00',
  '1.1;ATIVO CIRCULANTE;45.000,00;0,00;0,00;48.500,00',
  '1.1.3;ESTOQUES;29.350,00;49.200,00;46.550,00;32.000,00',
  '1.1.3.01;MATÉRIAS-PRIMAS;11.000,00;19.500,00;18.500,00;12.000,00',
  '1.1.3.02;PRODUTOS EM PROCESSO;4.500,00;5.200,00;4.700,00;5.000,00',
  '1.1.3.03;PRODUTOS ACABADOS;13.850,00;24.500,00;23.350,00;15.000,00',
  '1.1.3.09;PERDAS E QUEBRAS;0,00;608,64;0,00;608,64',
  '3.1.1.01;CMV;0,00;24.500,00;0,00;24.500,00 D',
  ';TOTAL DO ATIVO;45.000,00;;;48.500,00',
].join('\r\n');

const arquivo = (linhas: readonly string[]): Uint8Array => latin1(linhas.join('\r\n'));

function porCodigo(linhas: readonly LinhaBalancete[], codigo: string): LinhaBalancete {
  const encontrada = linhas.find((linha) => linha.codigo === codigo);
  if (encontrada === undefined) throw new Error(`Conta ${codigo} não foi lida.`);
  return encontrada;
}

describe('balancete completo', () => {
  const resultado = lerBalancete(latin1(BALANCETE));

  it('acha o cabeçalho depois do preâmbulo do relatório', () => {
    expect(resultado.perfil?.balancete?.linhaCabecalho).toBe(5);
    expect(resultado.perfil?.balancete?.colunas).toEqual({
      codigo: 0,
      descricao: 1,
      saldoAnterior: 2,
      debito: 3,
      credito: 4,
      saldoAtual: 5,
    });
  });

  it('detecta o dialeto e a codificação do arquivo', () => {
    expect(resultado.perfil?.dialeto).toEqual({
      formato: 'delimitado',
      codificacao: 'windows-1252',
      delimitador: ';',
      separadorDecimal: ',',
    });
  });

  it('preserva a acentuação da descrição da conta', () => {
    expect(porCodigo(resultado.linhas, '1.1.3.01').descricao).toBe('MATÉRIAS-PRIMAS');
  });

  it('lê a competência do cabeçalho, pela data final do intervalo', () => {
    expect(resultado.competencia).toEqual({ ano: 2025, mes: 8 });
  });

  it('lê saldos em centavos', () => {
    const mp = porCodigo(resultado.linhas, '1.1.3.01');
    expect(mp.saldoAnterior).toBe(1_100_000n);
    expect(mp.saldoAtual).toBe(1_200_000n);
    expect(mp.debito).toBe(1_950_000n);
    expect(mp.credito).toBe(1_850_000n);
  });

  it('descarta a linha de total sem confundi-la com conta', () => {
    expect(resultado.linhas.some((linha) => linha.descricao.startsWith('TOTAL'))).toBe(false);
    expect(resultado.linhas).toHaveLength(8);
  });

  it('marca conta sintética, para que somar grupo e filha não conte duas vezes', () => {
    expect(porCodigo(resultado.linhas, '1').sintetica).toBe(true);
    expect(porCodigo(resultado.linhas, '1.1.3').sintetica).toBe(true);
    expect(porCodigo(resultado.linhas, '1.1.3.01').sintetica).toBe(false);
    expect(porCodigo(resultado.linhas, '3.1.1.01').sintetica).toBe(false);
  });

  it('registra o grau da conta no plano', () => {
    expect(porCodigo(resultado.linhas, '1').grau).toBe(1);
    expect(porCodigo(resultado.linhas, '1.1.3').grau).toBe(3);
    expect(porCodigo(resultado.linhas, '1.1.3.01').grau).toBe(4);
  });

  it('guarda o número da linha física de cada conta, para o aviso navegável', () => {
    expect(porCodigo(resultado.linhas, '1.1.3.01').linha).toBe(10);
  });

  it('lê a natureza D sem inverter o sinal', () => {
    expect(porCodigo(resultado.linhas, '3.1.1.01').saldoAtual).toBe(2_450_000n);
  });

  it('não reclama de nada num arquivo bom, além de informar a codificação', () => {
    expect(resultado.diagnosticos.filter((d) => d.severidade !== 'info')).toEqual([]);
  });
});

describe('arquivo torto', () => {
  it('lista a linha inválida com número e motivo, e importa o resto', () => {
    const resultado = lerBalancete(
      arquivo([
        'Período: 01/08/2025 a 31/08/2025',
        CABECALHO,
        '1.1.3.01;MATÉRIAS-PRIMAS;11.000,00;19.500,00;18.500,00;12.000,00',
        '1.1.3.02;PRODUTOS EM PROCESSO;4.500,00;5.200,00;4.700,00;#VALOR!',
        '1.1.3.03;PRODUTOS ACABADOS;13.850,00;24.500,00;23.350,00;15.000,00',
      ]),
    );

    expect(resultado.linhas).toHaveLength(2);
    const erro = resultado.diagnosticos.find((d) => d.severidade === 'erro');
    expect(erro).toMatchObject({
      codigo: 'saldo-ilegivel',
      ancora: { tipo: 'linha', linha: 4, coluna: 'saldo atual' },
    });
    expect(erro?.mensagem).toContain('#VALOR!');
  });

  it('não deixa uma linha curta derrubar o lote', () => {
    const resultado = lerBalancete(
      arquivo([
        'Período: 01/08/2025 a 31/08/2025',
        CABECALHO,
        '1.1.3.01;MATÉRIAS-PRIMAS;11.000,00;19.500,00;18.500,00;12.000,00',
        '1.1.3.02;PRODUTOS EM PROCESSO;4.500,00',
        '1.1.3.03;PRODUTOS ACABADOS;13.850,00;24.500,00;23.350,00;15.000,00',
      ]),
    );

    expect(resultado.linhas).toHaveLength(2);
    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({
        codigo: 'colunas-insuficientes',
        ancora: { tipo: 'linha', linha: 4 },
      }),
    );
  });

  it('pula o cabeçalho repetido na quebra de página', () => {
    const resultado = lerBalancete(
      arquivo([
        'Período: 01/08/2025 a 31/08/2025',
        CABECALHO,
        '1.1.3.01;MATÉRIAS-PRIMAS;11.000,00;19.500,00;18.500,00;12.000,00',
        '',
        'Alimentos Boa Safra Ltda - folha 2',
        CABECALHO,
        '1.1.3.03;PRODUTOS ACABADOS;13.850,00;24.500,00;23.350,00;15.000,00',
      ]),
    );

    expect(resultado.linhas.map((linha) => linha.codigo)).toEqual(['1.1.3.01', '1.1.3.03']);
  });

  it('avisa quando a competência não está no arquivo, em vez de inventar uma', () => {
    const resultado = lerBalancete(
      arquivo([CABECALHO, '1.1.3.01;MATÉRIAS-PRIMAS;11.000,00;0,00;0,00;12.000,00']),
    );
    expect(resultado.competencia).toBeNull();
    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'competencia-nao-encontrada', severidade: 'aviso' }),
    );
  });

  it('aceita a competência informada pelo gestor quando o arquivo não a traz', () => {
    const resultado = lerBalancete(
      arquivo([CABECALHO, '1.1.3.01;MATÉRIAS-PRIMAS;11.000,00;0,00;0,00;12.000,00']),
      { competencia: { ano: 2025, mes: 8 } },
    );
    expect(resultado.competencia).toEqual({ ano: 2025, mes: 8 });
  });

  it('recusa o arquivo que não é balancete, dizendo por quê', () => {
    const resultado = lerBalancete(latin1('linha um\nlinha dois\nlinha três'));
    expect(resultado.linhas).toEqual([]);
    expect(resultado.perfil).toBeNull();
    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'cabecalho-nao-encontrado', severidade: 'erro' }),
    );
  });

  it('avisa sobre valor com mais casas que dinheiro, sem recusar a linha', () => {
    const resultado = lerBalancete(
      arquivo([
        'Período: 01/08/2025 a 31/08/2025',
        CABECALHO,
        '1.1.3.01;MATÉRIAS-PRIMAS;11.000,0000;0,00;0,00;12.000,4567',
      ]),
    );
    expect(resultado.linhas[0]?.saldoAtual).toBe(1_200_046n);
    expect(resultado.diagnosticos).toContainEqual(
      expect.objectContaining({ codigo: 'casas-decimais-inesperadas', severidade: 'aviso' }),
    );
  });
});

describe('ausência não é zero', () => {
  it('deixa o saldo sem valor como nulo, e o movimento em branco como zero', () => {
    // A assimetria é deliberada: coluna de movimento vazia em balancete
    // significa "não houve movimento"; saldo vazio significa "não veio no
    // arquivo", e tratá-lo como zero inventaria um estoque zerado.
    const resultado = lerBalancete(
      arquivo([
        'Período: 01/08/2025 a 31/08/2025',
        CABECALHO,
        '1.1.3.02;PRODUTOS EM PROCESSO;;;;5.000,00',
      ]),
    );
    const linha = resultado.linhas[0];
    expect(linha?.saldoAnterior).toBeNull();
    expect(linha?.debito).toBe(0n);
    expect(linha?.credito).toBe(0n);
    expect(linha?.saldoAtual).toBe(500_000n);
  });
});

describe('perfil de importação (RF-24)', () => {
  it('o layout detectado num arquivo lê o do mês seguinte sem redetectar nada', () => {
    // É a promessa da D8: o segundo cliente do mesmo ERP importa sem configurar.
    const primeiro = lerBalancete(latin1(BALANCETE));
    const perfil = primeiro.perfil as PerfilImportacao;

    const setembro = lerBalancete(
      latin1(
        BALANCETE.replace('01/08/2025 a 31/08/2025', '01/09/2025 a 30/09/2025').replace(
          '12.000,00',
          '12.047,00',
        ),
      ),
      { perfil },
    );

    expect(setembro.competencia).toEqual({ ano: 2025, mes: 9 });
    expect(porCodigo(setembro.linhas, '1.1.3.01').saldoAtual).toBe(1_204_700n);
    expect(setembro.perfil).toEqual(perfil);
  });
});

describe('outros layouts de ERP', () => {
  it('lê cabeçalho com "Conta" e "Descrição" sem trocar código por nome', () => {
    const resultado = lerBalancete(
      arquivo([
        'Balancete - 08/2025',
        'Conta;Descrição;Saldo Atual',
        '1.1.3.01;MATÉRIAS-PRIMAS;12.000,00',
      ]),
    );
    expect(resultado.linhas[0]).toMatchObject({
      codigo: '1.1.3.01',
      descricao: 'MATÉRIAS-PRIMAS',
      saldoAtual: 1_200_000n,
    });
    expect(resultado.competencia).toEqual({ ano: 2025, mes: 8 });
  });

  it('lê layout sem coluna de saldo anterior', () => {
    const resultado = lerBalancete(
      arquivo(['Balancete AGOSTO/2025', 'Código;Nome da Conta;Saldo Final', '1.1.3.01;MP;12.000,00']),
    );
    expect(resultado.perfil?.balancete?.colunas.saldoAnterior).toBeNull();
    expect(resultado.linhas[0]?.saldoAnterior).toBeNull();
    expect(resultado.competencia).toEqual({ ano: 2025, mes: 8 });
  });

  it('não confunde "Saldo Anterior" com "Saldo Atual"', () => {
    const resultado = lerBalancete(
      arquivo([
        'Período: 31/08/2025',
        'Conta;Descrição;Saldo Anterior;Saldo Atual',
        '1.1.3.01;MP;11.000,00;12.000,00',
      ]),
    );
    expect(resultado.linhas[0]?.saldoAnterior).toBe(1_100_000n);
    expect(resultado.linhas[0]?.saldoAtual).toBe(1_200_000n);
  });
});
