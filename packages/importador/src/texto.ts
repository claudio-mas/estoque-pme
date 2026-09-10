/**
 * Bytes viram texto.
 *
 * Metade do trabalho do RF-01 mora aqui: o export de ERP brasileiro raramente é
 * UTF-8. Vem em Latin-1 de sistema Windows, ou em UTF-16 quando alguém salvou
 * pelo Excel como "Texto Unicode". Assumir UTF-8 não dá erro — dá "MATÉRIAS"
 * escrito errado no nome da conta, que o gestor só percebe depois.
 */
import type { Codificacao } from './tipos';

const BOM_UTF8 = [0xef, 0xbb, 0xbf];
const BOM_UTF16LE = [0xff, 0xfe];
const BOM_UTF16BE = [0xfe, 0xff];

function comecaCom(bytes: Uint8Array, prefixo: readonly number[]): boolean {
  return prefixo.length <= bytes.length && prefixo.every((b, i) => bytes[i] === b);
}

export interface TextoDecodificado {
  readonly texto: string;
  readonly codificacao: Codificacao;
}

/**
 * Decodifica detectando a codificação, ou usando a que o perfil já conhece.
 *
 * A detecção é por eliminação, não por adivinhação estatística: BOM quando
 * houver, senão UTF-8 em modo estrito — que **falha** em byte inválido — e só
 * então Windows-1252. É confiável porque acentuação em Latin-1 é sequência
 * inválida em UTF-8 quase sempre; um arquivo sem acento nenhum decodifica igual
 * nas duas e a escolha não importa.
 *
 * Windows-1252 e não ISO-8859-1: é o que o Windows realmente produz, e é
 * superconjunto do Latin-1 na faixa que interessa.
 */
export function decodificar(bytes: Uint8Array, forcada?: Codificacao): TextoDecodificado {
  if (forcada !== undefined) {
    return { texto: semBom(decodificarComo(bytes, forcada)), codificacao: forcada };
  }
  if (comecaCom(bytes, BOM_UTF8)) {
    return { texto: decodificarComo(bytes.subarray(3), 'utf-8'), codificacao: 'utf-8' };
  }
  if (comecaCom(bytes, BOM_UTF16LE)) {
    return { texto: decodificarComo(bytes.subarray(2), 'utf-16le'), codificacao: 'utf-16le' };
  }
  if (comecaCom(bytes, BOM_UTF16BE)) {
    return { texto: decodificarComo(bytes.subarray(2), 'utf-16be'), codificacao: 'utf-16be' };
  }

  try {
    const texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { texto, codificacao: 'utf-8' };
  } catch {
    return { texto: decodificarComo(bytes, 'windows-1252'), codificacao: 'windows-1252' };
  }
}

function decodificarComo(bytes: Uint8Array, codificacao: Codificacao): string {
  return new TextDecoder(codificacao).decode(bytes);
}

function semBom(texto: string): string {
  return texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
}

/**
 * Forma canônica para comparar cabeçalho e rótulo: sem acento, sem caixa, sem
 * pontuação, espaço colapsado.
 *
 * "Saldo Anterior", "SALDO ANTER.", "saldo  anterior" precisam bater no mesmo
 * alvo — nenhum ERP escreve igual ao outro.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
