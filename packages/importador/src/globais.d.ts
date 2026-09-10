/**
 * A única API de plataforma de que este pacote depende, declarada à mão.
 *
 * `TextDecoder` é do padrão Encoding e existe igual no navegador e no Node —
 * mas não está na lib `ES2022`. As duas saídas fáceis pioram o pacote: incluir
 * `DOM` deixa `document` e `window` ao alcance de quem editar depois, e incluir
 * `@types/node` deixa `fs` e `Buffer`. Qualquer uma das duas convida a escrever
 * aqui o código que quebraria a pureza — e o compilador deixaria passar.
 *
 * Declarar só o que se usa é o que faz o próprio tipo dizer onde é a fronteira.
 */

declare class TextDecoder {
  constructor(rotulo?: string, opcoes?: { readonly fatal?: boolean; readonly ignoreBOM?: boolean });
  decode(entrada?: ArrayBufferView | ArrayBuffer): string;
}

/** Só os testes codificam; a leitura nunca escreve bytes. */
declare class TextEncoder {
  encode(entrada?: string): Uint8Array;
}
