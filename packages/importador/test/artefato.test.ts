/**
 * Balancete ou razão, decidido por pontuação e não por primeiro acerto.
 */
import { describe, expect, it } from 'vitest';
import { detectarArtefato, lerCsv } from '../src/index';

const registros = (linhas: readonly string[]) => lerCsv(linhas.join('\r\n'), ';');

describe('detectar o artefato', () => {
  it('reconhece o balancete, mesmo com preâmbulo', () => {
    const r = detectarArtefato(
      registros([
        'BALANCETE DE VERIFICAÇÃO',
        'Período: 01/08/2025 a 31/08/2025',
        'Classificação;Descrição;Saldo Anterior;Débito;Crédito;Saldo Atual',
        '1.1.3.01;MP;11.000,00;19.500,00;18.500,00;12.000,00',
      ]),
    );
    expect(r?.artefato).toBe('balancete');
    // O de razão também aceita este cabeçalho — por isso a pontuação importa.
    expect(r?.notaDoOutro).toBeGreaterThan(0);
    expect(r?.nota).toBeGreaterThan(r?.notaDoOutro ?? 0);
  });

  it('reconhece o razão em bloco pelo cabeçalho de colunas', () => {
    const r = detectarArtefato(
      registros([
        'RAZÃO ANALÍTICO',
        'Data;Histórico;Contrapartida;Débito;Crédito;Saldo',
        'CONTA: 1.1.3.01 - MP',
      ]),
    );
    expect(r?.artefato).toBe('razao');
  });

  it('reconhece o razão plano', () => {
    const r = detectarArtefato(registros(['Conta;Data;Histórico;Contrapartida;Valor;D/C']));
    expect(r?.artefato).toBe('razao');
  });

  it('não inventa artefato para arquivo que não é nenhum dos dois', () => {
    expect(detectarArtefato(registros(['Nome;Endereço;Telefone', 'Fulano;Rua A;1234']))).toBeNull();
  });
});
