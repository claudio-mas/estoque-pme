/**
 * Tipos do domínio.
 *
 * Duas regras do CLAUDE.md estão codificadas aqui, de propósito, no sistema de
 * tipos e não em comentários: dinheiro nunca é `number`, e ausência nunca é
 * zero. Se um cálculo puder deixar de ter resposta, o tipo do resultado obriga
 * quem chama a tratar esse caso.
 */

/** Os três níveis de estoque industrial. */
export type Nivel = 'MP' | 'PP' | 'PA';

/**
 * Valor monetário em centavos.
 *
 * Nunca use `number` para dinheiro (D11). Razões e prazos são `number`; saldos,
 * custos e tetos são `Centavos`.
 */
export type Centavos = bigint;

/** Qual saldo alimentou o cálculo do PME. O relatório precisa exibir isso (D5). */
export type BaseEstoque = 'medio' | 'fechamento';

/**
 * Resultado do PME de um nível num período.
 *
 * `ausente` é o nível que a empresa não movimenta — tipicamente PP em operação
 * de processo curto (D6). Não é zero, e não pode ser somado como se fosse.
 */
export type Pme =
  | { readonly estado: 'calculado'; readonly dias: number; readonly base: BaseEstoque }
  | { readonly estado: 'ausente' }
  | { readonly estado: 'indefinido'; readonly motivo: string };

/**
 * Taxa de perda do período.
 *
 * `naoMedido` é o caso da empresa que deixa a quebra correr dentro do CMV sem
 * conta de baixa própria (D7). Informar 0% a ela seria pior do que não informar.
 */
export type Perda =
  | { readonly estado: 'medido'; readonly taxa: number }
  | { readonly estado: 'naoMedido' };

/** Cobertura total em dias, somando apenas os níveis que a empresa movimenta. */
export type Cobertura =
  | { readonly estado: 'calculado'; readonly dias: number; readonly niveis: readonly Nivel[] }
  | { readonly estado: 'indefinido'; readonly motivo: string };
