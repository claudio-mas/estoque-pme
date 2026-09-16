/**
 * Um arquivo qualquer vira balancete ou razão, sem perguntar — com bytes reais.
 */
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { lerArquivo } from '../src/servidor/arquivo';

const latin1 = (t: string) => Uint8Array.from([...t].map((c) => c.charCodeAt(0)));

describe('ler um arquivo do ERP', () => {
  it('CSV de balancete', async () => {
    const lido = await lerArquivo(
      latin1(
        [
          'Período: 01/08/2025 a 31/08/2025',
          'Classificação;Descrição;Saldo Anterior;Saldo Atual',
          '1.1.3.01;MP;11.000,00;12.000,00',
        ].join('\r\n'),
      ),
    );
    expect(lido.artefato).toBe('balancete');
    if (lido.artefato !== 'balancete') return;
    expect(lido.resultado.linhas[0]?.saldoAtual).toBe(1_200_000n);
  });

  it('CSV de razão, sem que ninguém diga que é razão', async () => {
    const lido = await lerArquivo(
      latin1(
        [
          'Período: 01/08/2025 a 31/08/2025',
          'Data;Histórico;Contrapartida;Débito;Crédito;Saldo',
          'CONTA: 1.1.3.01 - MP',
          '05/08/2025;COMPRA;2.1.1;19.500,00;;30.500,00',
        ].join('\r\n'),
      ),
    );
    expect(lido.artefato).toBe('razao');
  });

  it('XLSX, detectado pelos bytes e depois pelo cabeçalho', async () => {
    const wb = new ExcelJS.Workbook();
    const aba = wb.addWorksheet('Balancete');
    aba.addRow(['AGOSTO/2025']);
    aba.addRow(['Conta', 'Descrição', 'Saldo Atual']);
    aba.addRow(['1.1.3.01', 'MP', 12000]);
    const bytes = new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);

    const lido = await lerArquivo(bytes);
    expect(lido.artefato).toBe('balancete');
    if (lido.artefato !== 'balancete') return;
    expect(lido.resultado.perfil?.dialeto.formato).toBe('planilha');
  });

  it('arquivo que não é nenhum dos dois diz isso, sem lançar', async () => {
    const lido = await lerArquivo(latin1('Nome;Telefone\r\nFulano;1234'));
    expect(lido.artefato).toBeNull();
  });
});
