/**
 * A forma de uma planilha já convertida, sem depender de quem a converteu.
 *
 * Mora fora de `planilha.ts` de propósito: aquele módulo importa o ExcelJS, e
 * `balancete.ts` e `razao.ts` precisam destes tipos sem arrastar a dependência
 * junto. Quem só lê CSV não carrega o leitor de XLSX.
 */
import type { RegistroCsv } from './csv';

/** Uma aba, já nos registros que o resto do pacote consome. */
export interface Aba {
  readonly nome: string;
  readonly registros: readonly RegistroCsv[];
}

export interface Planilha {
  readonly abas: readonly Aba[];
}

/**
 * O separador decimal que a conversão de planilha **emite**.
 *
 * Não é detecção, é escolha: a célula numérica de uma planilha não tem
 * separador nenhum — é um número —, e precisa virar texto para atravessar o
 * mesmo `lerValor` que lê o CSV. Emitir em pt-BR deixa célula numérica e célula
 * de texto (que o ERP brasileiro escreve como `1.234,56`) na mesma convenção
 * dentro da mesma aba, que é a mistura que aparece em arquivo real.
 */
export const DECIMAL_DA_PLANILHA = ',' as const;
