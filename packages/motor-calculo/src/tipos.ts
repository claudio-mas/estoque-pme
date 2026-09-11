/**
 * Tipos do domínio.
 *
 * Duas regras do CLAUDE.md estão codificadas aqui, de propósito, no sistema de
 * tipos e não em comentários: dinheiro nunca é `number`, e ausência nunca é
 * zero. Se um cálculo puder deixar de ter resposta, o tipo do resultado obriga
 * quem chama a tratar esse caso.
 */

import type { Motivo } from './diagnostico';

/** Os três níveis de estoque industrial. */
export type Nivel = 'MP' | 'PP' | 'PA';

/**
 * A competência mensal: o ano e o mês a que um dado pertence.
 *
 * Mora aqui, e não no importador onde nasceu, porque é vocabulário do domínio
 * antes de ser detalhe de arquivo — o cenário e o backtesting falam dela sem
 * saber que existe importação. O importador a reexporta.
 */
export interface Competencia {
  readonly ano: number;
  /** 1 a 12. */
  readonly mes: number;
}

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
  | { readonly estado: 'indefinido'; readonly motivo: Motivo };

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
  | { readonly estado: 'indefinido'; readonly motivo: Motivo };

/**
 * O saldo de um nível num período, ou a razão de não haver saldo.
 *
 * Espelha `Pme` de propósito, caso a caso: `lido` vira `calculado`, `ausente`
 * atravessa intacto, `indefinido` curto-circuita o cálculo carregando o motivo.
 * A distinção que este tipo existe para preservar é entre o nível que a empresa
 * não movimenta (D6) e o nível cuja conta ninguém classificou ainda — o segundo
 * é `indefinido`, nunca `ausente`, porque tratá-lo como ausência esconderia
 * estoque atrás de uma decisão que não foi tomada.
 */
export type SaldoDeNivel =
  | {
      readonly estado: 'lido';
      /** `null` quando não houver período anterior (D5). */
      readonly abertura: Centavos | null;
      readonly fechamento: Centavos;
    }
  | { readonly estado: 'ausente' }
  | { readonly estado: 'indefinido'; readonly motivo: Motivo };

/**
 * O consumo de um nível no período, lido do razão.
 *
 * É o denominador do indicador de perda (RF-13) e, no caso de MP, o custo de
 * materiais. `indefinido` é o caso em que a contrapartida de algum crédito não
 * veio no arquivo ou não está mapeada: derivar assim mesmo escolheria um dos
 * dois erros possíveis e o cometeria em silêncio (ADR-0005).
 */
export type ConsumoDeNivel =
  | { readonly estado: 'lido'; readonly valor: Centavos }
  | { readonly estado: 'indefinido'; readonly motivo: Motivo };

/**
 * O custo de materiais e **de onde ele veio** (RF-29).
 *
 * A origem vive dentro do resultado, não num campo paralelo, pelo mesmo motivo
 * que `Pme` carrega `base`: o relatório tem de dizer qual origem usou, e dois
 * campos separados podem divergir. `conferido` é o caso em que existem os dois
 * — deriva-se do razão e o gestor também digitou —, e a `divergencia` é a razão
 * entre a diferença e o derivado, para comparar com o limite do RF-29.
 */
export type CustoDeMateriais =
  | { readonly origem: 'derivado'; readonly valor: Centavos }
  | { readonly origem: 'informado'; readonly valor: Centavos }
  | {
      readonly origem: 'conferido';
      readonly valor: Centavos;
      readonly informado: Centavos;
      readonly divergencia: number;
    }
  | { readonly origem: 'indefinido'; readonly motivo: Motivo };

/**
 * Os números realizados de uma empresa num período.
 *
 * É o que a apuração consome e o que a importação produz. Não carrega a
 * empresa: quem a identifica é a persistência, e mantê-la fora é o que deixa
 * este pacote puro.
 *
 * `cmv` e `receita` são `null` quando a conta não está mapeada — sem CMV não há
 * PME de PP nem de PA, e sem receita não há NCG nem ciclo financeiro (D2). Nos
 * dois casos o indicador sai indefinido com motivo, nunca zerado.
 *
 * `perdas` é `null` quando não há conta de baixa mapeada para o nível: é o
 * **não medido** do D7, que `perdaMedida` já trata, e conta pendente cai
 * corretamente no mesmo caso — o produto de fato não sabe quanto foi.
 */
export interface Lancamento {
  readonly competencia: Competencia;
  readonly estoque: Readonly<Record<Nivel, SaldoDeNivel>>;
  readonly cmv: Centavos | null;
  readonly receita: Centavos | null;
  readonly perdas: Readonly<Record<Nivel, Centavos | null>>;
  /**
   * O que o razão disse. `custoMateriais` é o que o produto decidiu usar, e
   * quando os dois divergem é exatamente aí que o RF-29 tem algo a dizer — um
   * campo só apagaria a diferença que o requisito existe para mostrar.
   */
  readonly consumo: Readonly<Record<Nivel, ConsumoDeNivel>>;
  readonly custoMateriais: CustoDeMateriais;
  /** Entradas de MP que não vieram de outro nível de estoque. Entrada do `ncg`. */
  readonly compras: Centavos | null;
}
