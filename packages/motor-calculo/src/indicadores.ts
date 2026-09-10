/**
 * Indicadores derivados: cobertura, giro, ciclo financeiro, NCG e perda.
 */
import { multiplicarPorTaxa, quociente } from './dinheiro';
import { DIAS_DO_PERIODO } from './periodo';
import type { Centavos, Cobertura, Nivel, Perda, Pme } from './tipos';

/**
 * Soma os PMEs dos níveis que a empresa movimenta.
 *
 * Nível ausente é pulado, não somado como zero (D6), e a lista de níveis que
 * entraram volta junto — sem ela, a cobertura de uma empresa de dois níveis é
 * indistinguível da de uma empresa de três com PP zerado.
 */
export function cobertura(pmes: Readonly<Partial<Record<Nivel, Pme>>>): Cobertura {
  let dias = 0;
  const niveis: Nivel[] = [];

  for (const nivel of ['MP', 'PP', 'PA'] as const) {
    const pme = pmes[nivel];
    if (pme === undefined || pme.estado === 'ausente') continue;
    if (pme.estado === 'indefinido') {
      return { estado: 'indefinido', motivo: `PME de ${nivel} indefinido: ${pme.motivo}` };
    }
    dias += pme.dias;
    niveis.push(nivel);
  }

  if (niveis.length === 0) {
    return { estado: 'indefinido', motivo: 'nenhum nível movimentado no período' };
  }
  return { estado: 'calculado', dias, niveis };
}

/** Giro anualizado do estoque. */
export function giroAnualizado(cmvDoze: Centavos, estoqueMedio: Centavos): number {
  return quociente(cmvDoze, estoqueMedio);
}

/** Ciclo financeiro em dias: cobertura + prazo de recebimento − prazo de pagamento. */
export function cicloFinanceiro(coberturaDias: number, pmr: number, pmp: number): number {
  return coberturaDias + pmr - pmp;
}

export interface EntradaNcg {
  readonly estoque: Centavos;
  readonly receita: Centavos;
  readonly compras: Centavos;
  /** Prazo médio de recebimento, em dias. Parâmetro do cenário (D2). */
  readonly pmr: number;
  /** Prazo médio de pagamento, em dias. Parâmetro do cenário (D2). */
  readonly pmp: number;
  readonly dias?: number;
}

/**
 * Necessidade de capital de giro.
 *
 *     NCG = Estoque + (Receita × PMR / d) − (Compras × PMP / d)
 *
 * PMR e PMP são entrada do gestor, não apuração de contas a receber e a pagar.
 */
export function ncg(entrada: EntradaNcg): Centavos {
  const dias = entrada.dias ?? DIAS_DO_PERIODO;
  const recebiveis = multiplicarPorTaxa(entrada.receita, entrada.pmr / dias);
  const fornecedores = multiplicarPorTaxa(entrada.compras, entrada.pmp / dias);
  return entrada.estoque + recebiveis - fornecedores;
}

/**
 * Custo de materiais derivado do razão da conta de MP (RF-29).
 *
 *     Consumo = MP_inicial + Compras − MP_final
 *
 * É a identidade do RF-26 lida ao contrário. Custo de materiais não é linha de
 * balancete nem de DRE: digitado à mão, erra o PME de MP e contamina o teto de
 * compra sem que nada acuse.
 */
export function custoMateriaisDerivado(
  mpInicial: Centavos,
  compras: Centavos,
  mpFinal: Centavos,
): Centavos {
  return mpInicial + compras - mpFinal;
}

/**
 * Taxa de perda medida das contas de baixa (RF-13).
 *
 *     perda% = Perdas_do_período / Consumo_do_período
 *
 * `perdas` é `null` quando a empresa não tem conta de baixa mapeada — e aí o
 * resultado é `naoMedido`, nunca 0% (D7). Muita PME deixa a quebra correr dentro
 * do CMV; informar "sem perdas" a ela seria pior do que não informar.
 */
export function perdaMedida(perdas: Centavos | null, consumo: Centavos): Perda {
  if (perdas === null || consumo === 0n) {
    return { estado: 'naoMedido' };
  }
  return { estado: 'medido', taxa: quociente(perdas, consumo) };
}

/**
 * Custo sob uma taxa de perda de cenário, como razão de rendimentos.
 *
 *     Custo_cenário = Custo_projetado × (1 − perda_base) / (1 − perda_cenário)
 *
 * NUNCA aplique `Custo / (1 − perda%)` sobre o consumo: o consumo lido do razão
 * já contém a perda, e corrigi-lo seria dupla contagem. Este foi o defeito da
 * formulação original da P7.
 *
 * Quando o cenário iguala a base, o resultado é o próprio custo projetado — a
 * alavanca vira no-op, que é o comportamento correto.
 */
export function custoSobPerdaDeCenario(
  custoProjetado: Centavos,
  perdaBase: number,
  perdaCenario: number,
): Centavos {
  for (const taxa of [perdaBase, perdaCenario]) {
    if (!Number.isFinite(taxa) || taxa < 0 || taxa >= 1) {
      throw new RangeError(`Taxa de perda fora de [0, 1): ${taxa}.`);
    }
  }
  if (perdaBase === perdaCenario) {
    return custoProjetado;
  }
  return multiplicarPorTaxa(custoProjetado, (1 - perdaBase) / (1 - perdaCenario));
}
