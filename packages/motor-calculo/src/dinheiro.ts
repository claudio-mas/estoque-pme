/**
 * Aritmética de dinheiro em centavos.
 *
 * `bigint` guarda o valor; `number` só aparece quando o cálculo é genuinamente
 * uma razão (PME em dias, taxa de perda, giro). Toda volta de `number` para
 * `Centavos` passa por `arredondarCentavos`, que é o único ponto de
 * arredondamento do motor.
 */
import type { Centavos } from './tipos';

const LIMITE_SEGURO = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Converte para `number` recusando valores fora da faixa de precisão exata.
 *
 * A faixa cobre R$ 90 trilhões em centavos, muito além de qualquer PME do
 * público-alvo — o guarda existe para que um dado corrompido falhe alto em vez
 * de produzir silenciosamente um número errado.
 */
export function paraNumero(valor: Centavos): number {
  if (valor > LIMITE_SEGURO || valor < -LIMITE_SEGURO) {
    throw new RangeError(`Valor ${valor} fora da faixa de precisão exata de number.`);
  }
  return Number(valor);
}

/** Arredonda meio para longe do zero, convenção brasileira para dinheiro. */
export function arredondarCentavos(valor: number): Centavos {
  if (!Number.isFinite(valor)) {
    throw new RangeError(`Valor não finito não vira dinheiro: ${valor}.`);
  }
  const arredondado = valor < 0 ? -Math.round(-valor) : Math.round(valor);
  if (!Number.isSafeInteger(arredondado)) {
    throw new RangeError(`Arredondamento de ${valor} sai da faixa de precisão exata.`);
  }
  return BigInt(arredondado);
}

/** Razão entre dois valores monetários. O resultado é adimensional. */
export function razao(numerador: Centavos, denominador: Centavos): number {
  if (denominador === 0n) {
    throw new RangeError('Razão com denominador zerado.');
  }
  return paraNumero(numerador) / paraNumero(denominador);
}

/** Multiplica dinheiro por uma taxa adimensional, arredondando ao centavo. */
export function multiplicarPorTaxa(valor: Centavos, taxa: number): Centavos {
  if (!Number.isFinite(taxa)) {
    throw new RangeError(`Taxa não finita: ${taxa}.`);
  }
  return arredondarCentavos(paraNumero(valor) * taxa);
}

export function somar(valores: readonly Centavos[]): Centavos {
  return valores.reduce((acumulado, valor) => acumulado + valor, 0n);
}

/** Média aritmética de valores monetários, arredondada ao centavo. */
export function media(valores: readonly Centavos[]): Centavos {
  if (valores.length === 0) {
    throw new RangeError('Média de lista vazia.');
  }
  return arredondarCentavos(paraNumero(somar(valores)) / valores.length);
}
