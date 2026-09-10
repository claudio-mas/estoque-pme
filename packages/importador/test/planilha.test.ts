/**
 * XLSX de verdade: o teste **escreve** a planilha e a lê de volta.
 *
 * Fixture de bytes literais não serve aqui — um `.xlsx` é um ZIP de XML, e
 * bytes colados à mão testariam a minha cópia do formato, não o formato. Gerar
 * com o ExcelJS e ler com o `lerPlanilha` exercita ida e volta pelo arquivo
 * real, incluindo célula numérica, data, fórmula e erro.
 *
 * O que estes testes prendem é a promessa da decisão: XLSX é **front-end** do
 * pipeline que já existe, então balancete e razão saem os dois de graça, com o
 * mesmo reconhecimento de layout.
 */
import { describe, expect, it } from 'vitest';
import { Workbook } from 'exceljs';
import { lerBalanceteDeAba, lerPlanilha, lerRazaoDeAba } from '../src/index';
import type { ContaRazao, LinhaBalancete } from '../src/index';

type Celula = string | number | Date | null | { formula: string; result: number };

async function planilhaCom(
  abas: Readonly<Record<string, readonly (readonly Celula[])[]>>,
): Promise<Uint8Array> {
  const workbook = new Workbook();
  for (const [nome, linhas] of Object.entries(abas)) {
    const aba = workbook.addWorksheet(nome);
    for (const linha of linhas) aba.addRow([...linha]);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

function porCodigo(linhas: readonly LinhaBalancete[], codigo: string): LinhaBalancete {
  const encontrada = linhas.find((linha) => linha.codigo === codigo);
  if (encontrada === undefined) throw new Error(`Conta ${codigo} não foi lida.`);
  return encontrada;
}

function contaDo(contas: readonly ContaRazao[], codigo: string): ContaRazao {
  const encontrada = contas.find((conta) => conta.codigo === codigo);
  if (encontrada === undefined) throw new Error(`Conta ${codigo} não foi lida.`);
  return encontrada;
}

describe('balancete em XLSX', () => {
  it('lê a planilha pelo mesmo caminho do CSV, com número em célula numérica', async () => {
    const bytes = await planilhaCom({
      Balancete: [
        ['BALANCETE DE VERIFICAÇÃO'],
        ['Período: 01/08/2025 a 31/08/2025'],
        [],
        ['Classificação', 'Descrição', 'Saldo Anterior', 'Débito', 'Crédito', 'Saldo Atual'],
        ['1.1.3', 'ESTOQUES', 29350, 49200, 46550, 32000],
        ['1.1.3.01', 'MATÉRIAS-PRIMAS', 11000, 19500, 18500, 12000],
        ['1.1.3.03', 'PRODUTOS ACABADOS', 13850, 24500, 23350, 15000],
      ],
    });

    const resultado = lerBalanceteDeAba(await lerPlanilha(bytes));

    expect(resultado.competencia).toEqual({ ano: 2025, mes: 8 });
    expect(resultado.perfil?.dialeto).toEqual({ formato: 'planilha', separadorDecimal: ',' });
    expect(porCodigo(resultado.linhas, '1.1.3.01').saldoAtual).toBe(1_200_000n);
    expect(porCodigo(resultado.linhas, '1.1.3.01').saldoAnterior).toBe(1_100_000n);
    expect(porCodigo(resultado.linhas, '1.1.3').sintetica).toBe(true);
    expect(resultado.diagnosticos.filter((d) => d.severidade === 'erro')).toEqual([]);
  });

  it('centavos sobrevivem à ida e volta pela célula numérica', async () => {
    const bytes = await planilhaCom({
      Balancete: [
        ['AGOSTO/2025'],
        ['Conta', 'Descrição', 'Saldo Atual'],
        ['1.1.3.01', 'MATÉRIAS-PRIMAS', 12000.45],
      ],
    });
    const resultado = lerBalanceteDeAba(await lerPlanilha(bytes));
    expect(porCodigo(resultado.linhas, '1.1.3.01').saldoAtual).toBe(1_200_045n);
  });

  it('usa o resultado da fórmula, não a fórmula', async () => {
    const bytes = await planilhaCom({
      Balancete: [
        ['AGOSTO/2025'],
        ['Conta', 'Descrição', 'Saldo Atual'],
        ['1.1.3.01', 'MATÉRIAS-PRIMAS', { formula: 'SUM(1000,11000)', result: 12000 }],
      ],
    });
    const resultado = lerBalanceteDeAba(await lerPlanilha(bytes));
    expect(porCodigo(resultado.linhas, '1.1.3.01').saldoAtual).toBe(1_200_000n);
  });

  it('escolhe a aba de dados quando a pasta tem aba de capa', async () => {
    const bytes = await planilhaCom({
      Capa: [['Relatório gerado por'], ['Sistema Contábil XYZ'], ['Emissão', '02/09/2025']],
      Dados: [
        ['AGOSTO/2025'],
        ['Classificação', 'Descrição', 'Saldo Anterior', 'Saldo Atual'],
        ['1.1.3.01', 'MATÉRIAS-PRIMAS', 11000, 12000],
      ],
    });
    const resultado = lerBalanceteDeAba(await lerPlanilha(bytes));
    expect(porCodigo(resultado.linhas, '1.1.3.01').saldoAtual).toBe(1_200_000n);
  });

  it('célula de texto em pt-BR na mesma aba lê igual à numérica', async () => {
    const bytes = await planilhaCom({
      Balancete: [
        ['AGOSTO/2025'],
        ['Conta', 'Descrição', 'Saldo Anterior', 'Saldo Atual'],
        ['1.1.3.01', 'MATÉRIAS-PRIMAS', '11.000,00', 12000],
      ],
    });
    const resultado = lerBalanceteDeAba(await lerPlanilha(bytes));
    const mp = porCodigo(resultado.linhas, '1.1.3.01');
    expect(mp.saldoAnterior).toBe(1_100_000n);
    expect(mp.saldoAtual).toBe(1_200_000n);
  });
});

describe('razão em XLSX', () => {
  it('sai de graça: mesmo reconhecimento de layout, outro artefato', async () => {
    const bytes = await planilhaCom({
      Razao: [
        ['RAZÃO ANALÍTICO'],
        ['Período: 01/08/2025 a 31/08/2025'],
        [],
        ['Conta', 'Data', 'Histórico', 'Contrapartida', 'Débito', 'Crédito'],
        ['1.1.3.01', new Date(Date.UTC(2025, 7, 5)), 'COMPRA NF 4471', '2.1.1.01', 19500, null],
        ['1.1.3.01', new Date(Date.UTC(2025, 7, 18)), 'REQUISIÇÃO', '1.1.3.02', null, 17891.36],
      ],
    });

    const resultado = lerRazaoDeAba(await lerPlanilha(bytes));

    expect(resultado.competencia).toEqual({ ano: 2025, mes: 8 });
    expect(resultado.perfil?.razao?.delimitacao).toBe('plano');

    const mp = contaDo(resultado.contas, '1.1.3.01');
    expect(mp.lancamentos).toHaveLength(2);
    expect(mp.lancamentos[0]?.debito).toBe(1_950_000n);
    expect(mp.lancamentos[1]?.credito).toBe(1_789_136n);
  });

  it('a data vira dd/mm/aaaa, que é o rastro que o gestor reconhece', async () => {
    const bytes = await planilhaCom({
      Razao: [
        ['Período: 01/08/2025 a 31/08/2025'],
        ['Conta', 'Data', 'Histórico', 'Débito', 'Crédito'],
        ['1.1.3.01', new Date(Date.UTC(2025, 7, 5)), 'COMPRA', 19500, null],
      ],
    });
    const resultado = lerRazaoDeAba(await lerPlanilha(bytes));
    expect(contaDo(resultado.contas, '1.1.3.01').lancamentos[0]?.data).toBe('05/08/2025');
  });
});

describe('arquivo que não serve', () => {
  it('planilha sem cabeçalho reconhecível diz isso, sem lançar', async () => {
    const bytes = await planilhaCom({ Plan1: [['Nome', 'Endereço'], ['Fulano', 'Rua A']] });
    const resultado = lerBalanceteDeAba(await lerPlanilha(bytes));
    expect(resultado.linhas).toEqual([]);
    expect(resultado.diagnosticos.map((d) => d.codigo)).toContain('cabecalho-nao-encontrado');
  });
});
