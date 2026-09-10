/**
 * Motor de cálculo do planejamento de estoque.
 *
 * Pacote puro: sem I/O, sem acesso a banco, sem dependências de runtime. Roda
 * igual no navegador e no servidor, que é o que permite recalcular na edição
 * dentro do orçamento de 2 s do RNF sem duplicar a aritmética (D11).
 */
export type { BaseEstoque, Centavos, Cobertura, Nivel, Perda, Pme } from './tipos';

export { DIAS_DO_PERIODO } from './periodo';

export {
  arredondarCentavos,
  media,
  multiplicarPorTaxa,
  paraNumero,
  razao,
  somar,
} from './dinheiro';

export { calcularPme, projetarEstoque } from './pme';
export type { EntradaPme } from './pme';

export {
  LIMITE_DISPERSAO_PREMISSA,
  dispersaoRelativa,
  mediaDosUltimos,
  porTaxaDeCrescimento,
  porTendenciaLinear,
  porUltimaObservacao,
} from './projecao';

export { comprasTeto, producaoTeto } from './tetos';
export type { EntradaCompras, EntradaProducao } from './tetos';

export {
  cicloFinanceiro,
  cobertura,
  custoMateriaisDerivado,
  custoSobPerdaDeCenario,
  giroAnualizado,
  ncg,
  perdaMedida,
} from './indicadores';
export type { EntradaNcg } from './indicadores';
