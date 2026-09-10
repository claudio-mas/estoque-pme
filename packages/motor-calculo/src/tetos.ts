/**
 * Tetos orçamentários de compra e produção (RF-26 e RF-27).
 *
 * Ambos saem inteiros das identidades de saldo do estoque, o que é exatamente o
 * que os mantém dentro da D1: são um número em reais, no nível agregado, sem
 * item, quantidade ou preço unitário.
 *
 *     MP_final = MP_inicial + Compras  − Consumo
 *     PA_final = PA_inicial + Produção − CMV
 *
 * Limite de apresentação, não de cálculo: o produto diz **quanto** em reais,
 * nunca **o quê** nem **quando**. Nomear estes números como sugestão ou ordem de
 * compra atravessa a fronteira do MRP e quebra a promessa do PRD.
 */
import type { Centavos } from './tipos';

export interface EntradaCompras {
  /** Estoque de MP alvo ao fim do período, projetado do PME alvo. */
  readonly mpAlvo: Centavos;
  /** Saldo de MP no início do período. */
  readonly mpInicial: Centavos;
  /** Consumo de materiais previsto no período. */
  readonly custoMateriais: Centavos;
}

/** Quanto o caixa suporta comprar de material no período. */
export function comprasTeto({ mpAlvo, mpInicial, custoMateriais }: EntradaCompras): Centavos {
  return mpAlvo - mpInicial + custoMateriais;
}

export interface EntradaProducao {
  /** Estoque de PA alvo ao fim do período, projetado do PME alvo. */
  readonly paAlvo: Centavos;
  /** Saldo de PA no início do período. */
  readonly paInicial: Centavos;
  /** CMV previsto no período. */
  readonly cmv: Centavos;
}

/**
 * Quanto o caixa suporta produzir no período, ao custo da produção acabada.
 *
 * Não carrega quantidade e **não verifica capacidade fabril** — é limite
 * financeiro, não plano de produção.
 */
export function producaoTeto({ paAlvo, paInicial, cmv }: EntradaProducao): Centavos {
  return paAlvo - paInicial + cmv;
}
