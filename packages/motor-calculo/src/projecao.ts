/**
 * Métodos de projeção da premissa (RF-10).
 *
 * Padrões: taxa de crescimento para as linhas de custo — é o que o modelo de
 * referência faz, 2% ao mês compostos — e média dos últimos 3 para o PME.
 *
 * Ainda não implementados aqui: média ponderada e mesmo mês do ano anterior.
 * O método manual não é cálculo: é o número que o gestor digitou.
 */
import { multiplicarPorTaxa } from './dinheiro';
import type { Centavos } from './tipos';

/**
 * Último realizado composto por uma taxa mensal fixa.
 *
 * Reproduz a coluna de custo da planilha de referência: 19.500 → 19.890 →
 * 20.288 → … a 2% ao mês. A composição é sempre sobre o valor projetado
 * anterior, não sobre o último realizado.
 */
export function porTaxaDeCrescimento(
  ultimoRealizado: Centavos,
  taxaMensal: number,
  periodos: number,
): Centavos[] {
  if (!Number.isFinite(taxaMensal) || taxaMensal <= -1) {
    throw new RangeError(`Taxa mensal inválida: ${taxaMensal}.`);
  }
  exigirPeriodos(periodos);

  const projetados: Centavos[] = [];
  let anterior = ultimoRealizado;
  for (let i = 0; i < periodos; i += 1) {
    anterior = multiplicarPorTaxa(anterior, 1 + taxaMensal);
    projetados.push(anterior);
  }
  return projetados;
}

/** Repete o último valor realizado por todo o horizonte. */
export function porUltimaObservacao<T>(serie: readonly T[], periodos: number): T[] {
  exigirPeriodos(periodos);
  const ultimo = serie.at(-1);
  if (ultimo === undefined) {
    throw new RangeError('Série vazia não tem última observação.');
  }
  return Array.from({ length: periodos }, () => ultimo);
}

/**
 * Média simples dos últimos `janela` valores de uma série adimensional.
 *
 * É o padrão do PME. Quando a série tiver menos elementos que a janela, usa o
 * que houver — projeção com histórico curto é fraca, mas o aviso de baixa
 * confiança é responsabilidade da camada de cima, não do motor.
 */
export function mediaDosUltimos(serie: readonly number[], janela: number): number {
  if (!Number.isInteger(janela) || janela < 1) {
    throw new RangeError(`Janela inválida: ${janela}.`);
  }
  const usados = serie.slice(-janela);
  if (usados.length === 0) {
    throw new RangeError('Série vazia não tem média.');
  }
  return usados.reduce((soma, valor) => soma + valor, 0) / usados.length;
}

/**
 * Dispersão relativa da janela: (máximo − mínimo) / média.
 *
 * Alimenta o aviso de premissa instável — acima de 15%, a média de 3 meses
 * deixa de ser uma boa premissa e a tela precisa dizer isso.
 */
export function dispersaoRelativa(serie: readonly number[]): number {
  if (serie.length === 0) {
    throw new RangeError('Série vazia não tem dispersão.');
  }
  const soma = serie.reduce((acumulado, valor) => acumulado + valor, 0);
  const media = soma / serie.length;
  if (media === 0) {
    throw new RangeError('Dispersão relativa indefinida com média zero.');
  }
  return (Math.max(...serie) - Math.min(...serie)) / media;
}

export const LIMITE_DISPERSAO_PREMISSA = 0.15;

/**
 * Tendência linear por mínimos quadrados, projetada `periodos` à frente.
 *
 * Série adimensional — para PME. Com menos de dois pontos não há reta, e o
 * método degrada para a última observação em vez de inventar inclinação.
 */
export function porTendenciaLinear(serie: readonly number[], periodos: number): number[] {
  exigirPeriodos(periodos);
  const n = serie.length;
  if (n === 0) {
    throw new RangeError('Série vazia não tem tendência.');
  }
  if (n === 1) {
    return porUltimaObservacao(serie, periodos);
  }

  const somaX = ((n - 1) * n) / 2;
  const mediaX = somaX / n;
  const mediaY = serie.reduce((soma, valor) => soma + valor, 0) / n;

  let numerador = 0;
  let denominador = 0;
  for (let i = 0; i < n; i += 1) {
    const desvioX = i - mediaX;
    numerador += desvioX * (serie[i] as number - mediaY);
    denominador += desvioX * desvioX;
  }

  const inclinacao = denominador === 0 ? 0 : numerador / denominador;
  const intercepto = mediaY - inclinacao * mediaX;

  return Array.from({ length: periodos }, (_, passo) => intercepto + inclinacao * (n + passo));
}

function exigirPeriodos(periodos: number): void {
  if (!Number.isInteger(periodos) || periodos < 1) {
    throw new RangeError(`Número de períodos inválido: ${periodos}.`);
  }
}
