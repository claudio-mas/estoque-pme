/**
 * Base temporal do modelo (D4).
 *
 * `d = 30` sobre fluxo mensal é idêntico à convenção contábil de 360 dias sobre
 * fluxo anual:
 *
 *     Estoque / (12 × CMV_mensal) × 360  =  Estoque / CMV_mensal × 30
 *
 * Por isso o produto concorda com o banco, o contador e o livro-texto, que
 * trabalham no ano comercial. A planilha de referência do cliente aplica 360 a
 * um fluxo mensal e anualiza duas vezes — seus PMEs são exatamente 12× maiores,
 * e a conversão para quem vem dela é dividir por 12.
 *
 * Constante nomeada de propósito, nunca literal espalhado pelo código: o viés de
 * calendário documentado no CLAUDE.md é aceito, não corrigido, e se o
 * backtesting mostrar que ele importa, trocar para dias corridos passa a ser
 * alteração de uma linha — as duas direções do modelo cancelam o fator.
 */
export const DIAS_DO_PERIODO = 30;
