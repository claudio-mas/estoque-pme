/**
 * O PME nas duas direções.
 *
 * Uma relação só, usada de dois jeitos: do histórico extrai-se o prazo, do prazo
 * estimado projeta-se o estoque. As duas são inversas exatas, e é por isso que o
 * fator `d` se cancela no estoque projetado.
 */
import { DIAS_DO_PERIODO } from './periodo';
import { media, multiplicarPorTaxa, razao } from './dinheiro';
import type { BaseEstoque, Centavos, Pme } from './tipos';

export interface EntradaPme {
  /** Saldo de abertura. `null` quando não houver período anterior (D5). */
  readonly estoqueAbertura: Centavos | null;
  /** Saldo de fechamento. `null` quando a empresa não movimenta o nível (D6). */
  readonly estoqueFechamento: Centavos | null;
  /** Custo de materiais para MP; CMV para PP e PA. */
  readonly custoDirecionador: Centavos;
  readonly dias?: number;
}

/**
 * Apura o PME de um nível num período.
 *
 *     PME = Estoque / Custo_direcionador × d
 *
 * O estoque é o médio entre abertura e fechamento, degradando para o saldo de
 * fechamento quando não houver abertura (D5). Com a ingestão por balancete (D3)
 * essa degradação é caminho raro: o balancete traz saldo anterior em toda linha,
 * inclusive no primeiro período da série, então só lançamento manual cai nela.
 */
export function calcularPme(entrada: EntradaPme): Pme {
  const { estoqueAbertura, estoqueFechamento, custoDirecionador } = entrada;

  if (estoqueFechamento === null) {
    return { estado: 'ausente' };
  }
  if (custoDirecionador === 0n) {
    return { estado: 'indefinido', motivo: 'custo direcionador zerado no período' };
  }
  if (custoDirecionador < 0n) {
    return { estado: 'indefinido', motivo: 'custo direcionador negativo no período' };
  }

  const dias = entrada.dias ?? DIAS_DO_PERIODO;
  const base: BaseEstoque = estoqueAbertura === null ? 'fechamento' : 'medio';
  const estoque =
    estoqueAbertura === null ? estoqueFechamento : media([estoqueAbertura, estoqueFechamento]);

  return { estado: 'calculado', dias: razao(estoque, custoDirecionador) * dias, base };
}

/**
 * Projeta o estoque de um nível a partir do custo previsto e do PME alvo.
 *
 *     Estoque = Custo_previsto × PME_alvo / d
 */
export function projetarEstoque(
  custoProjetado: Centavos,
  pmeAlvoDias: number,
  dias: number = DIAS_DO_PERIODO,
): Centavos {
  if (pmeAlvoDias < 0) {
    throw new RangeError(`PME alvo negativo: ${pmeAlvoDias}.`);
  }
  return multiplicarPorTaxa(custoProjetado, pmeAlvoDias / dias);
}
