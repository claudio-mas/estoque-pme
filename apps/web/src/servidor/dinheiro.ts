/**
 * Dinheiro entre a tela e o modelo: pt-BR de um lado, centavos do outro.
 *
 * Nunca passa por float. `parseFloat('18.500,00')` devolve 18.5 em silêncio, e
 * o arredondamento binário é exatamente o que guardar centavos em `bigint`
 * existe para evitar (D11).
 */

/** "18.500,00" → 1_850_000n. Aceita sem milhar e sem centavos; sinal na frente. */
export function centavosDe(texto: string): bigint {
  const negativo = texto.trim().startsWith('-');
  const [inteiro = '0', fracao = ''] = texto.trim().replace('-', '').replace(/\./g, '').split(',');
  const centavos = BigInt(inteiro || '0') * 100n + BigInt(fracao.padEnd(2, '0').slice(0, 2));
  return negativo ? -centavos : centavos;
}

const reais = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

/** 1_850_000n → "R$ 18.500,00". Divide em inteiro e centavos antes de formatar. */
export function formatarCentavos(valor: bigint): string {
  const negativo = valor < 0n;
  const abs = negativo ? -valor : valor;
  // Number() só sobre o inteiro em reais: dentro da faixa exata para qualquer PME.
  const numero = Number(abs / 100n) + Number(abs % 100n) / 100;
  return reais.format(negativo ? -numero : numero);
}
