/**
 * Número brasileiro vira centavos.
 *
 * Nenhum ponto deste arquivo passa por `parseFloat`. O caminho é string →
 * `bigint`, direto: `parseFloat('1.234,56')` devolve 1.234 silenciosamente, e o
 * arredondamento binário do float é exatamente o que a decisão de guardar
 * dinheiro em centavos existe para evitar. Converter o texto certo por um
 * caminho errado é pior do que não converter.
 */
import type { Centavos } from '@estoque-pme/motor-calculo';
import type { SeparadorDecimal } from './tipos';

/** Natureza do saldo contábil: devedor ou credor. */
export type Natureza = 'D' | 'C';

export type ValorLido =
  | { readonly estado: 'vazio' }
  | { readonly estado: 'lido'; readonly valor: Centavos; readonly natureza: Natureza | null }
  | { readonly estado: 'invalido'; readonly motivo: string };

/** Casas decimais que um valor pode ter antes de virar suspeito de não ser dinheiro. */
export const CASAS_DECIMAIS_ESPERADAS = 2;

/**
 * Lê um valor monetário exportado por ERP brasileiro.
 *
 * Cobre, porque tudo isto aparece em arquivo real: `1.234,56`, `1234,56`,
 * `R$ 1.234,56`, `1.234,56 D`, `1.234,56C`, `(1.234,56)` para negativo,
 * `-1.234,56`, `1.234,56-` com sinal ao final (herança de relatório de
 * mainframe) e espaço não separável no lugar do espaço.
 *
 * O sinal e a natureza são coisas diferentes e ambas voltam: `natureza` é o D/C
 * que o ERP escreveu, e `valor` já vem com o sinal contábil aplicado — crédito
 * é negativo. Para conta de estoque, que é do ativo, saldo credor significa
 * estoque negativo, e o RF-03 precisa enxergar isso como número negativo, não
 * como uma letra guardada à parte.
 */
export function lerValor(bruto: string, decimal: SeparadorDecimal): ValorLido {
  let texto = bruto.replace(/\u00a0/g, ' ').trim();
  if (texto === '' || texto === '-' || normalizado(texto) === 'nulo') {
    return { estado: 'vazio' };
  }

  let negativo = false;
  let natureza: Natureza | null = null;

  // Parênteses: convenção contábil para negativo.
  const entreParenteses = /^\((.*)\)$/.exec(texto);
  if (entreParenteses) {
    negativo = true;
    texto = (entreParenteses[1] ?? '').trim();
  }

  // Natureza D/C, colada ou separada, antes ou depois do número.
  const comNatureza = /^(?:([DC])\s*)?(.*?)(?:\s*([DC]))?$/i.exec(texto);
  if (comNatureza) {
    const letra = comNatureza[1] ?? comNatureza[3];
    if (letra !== undefined) {
      natureza = letra.toUpperCase() as Natureza;
      texto = (comNatureza[2] ?? '').trim();
    }
  }

  texto = texto.replace(/^r\$\s*/i, '').trim();

  // Sinal à esquerda ou à direita.
  const sinalDireita = /^(.*?)\s*([+-])$/.exec(texto);
  if (sinalDireita) {
    if (sinalDireita[2] === '-') negativo = !negativo;
    texto = (sinalDireita[1] ?? '').trim();
  }
  const sinalEsquerda = /^([+-])\s*(.*)$/.exec(texto);
  if (sinalEsquerda) {
    if (sinalEsquerda[1] === '-') negativo = !negativo;
    texto = (sinalEsquerda[2] ?? '').trim();
  }

  if (texto === '') {
    return { estado: 'invalido', motivo: `"${bruto.trim()}" não tem dígito algum` };
  }

  const milhar = decimal === ',' ? '.' : ',';
  const semMilhar = texto.split(milhar).join('');
  if (!ehNumeroSimples(semMilhar, decimal)) {
    return { estado: 'invalido', motivo: `"${bruto.trim()}" não é um número` };
  }

  const [inteiro = '0', fracao = ''] = semMilhar.split(decimal);
  const centavos = paraCentavos(inteiro, fracao);
  if (centavos === null) {
    return { estado: 'invalido', motivo: `"${bruto.trim()}" excede a faixa suportada` };
  }

  const credito = natureza === 'C';
  const sinal = negativo !== credito ? -1n : 1n;
  return { estado: 'lido', valor: sinal * centavos, natureza };
}

/**
 * Dígitos, com no máximo um separador decimal entre eles.
 *
 * Escrito à mão em vez de por `RegExp` montada em template: o separador é
 * dado em tempo de execução, e interpolar um caractere dentro de um padrão é
 * como se injeta um metacaractere sem perceber. Aqui ele é comparado, nunca
 * compilado.
 */
function ehNumeroSimples(texto: string, decimal: SeparadorDecimal): boolean {
  let digitos = 0;
  let separadores = 0;
  for (const c of texto) {
    if (c >= '0' && c <= '9') {
      digitos += 1;
    } else if (c === decimal) {
      // Separador antes de qualquer dígito, ou repetido, não é número.
      if (digitos === 0 || separadores > 0) return false;
      separadores += 1;
    } else {
      return false;
    }
  }
  // "12," não é número: se há separador, tem que haver casa depois dele.
  return digitos > 0 && (separadores === 0 || !texto.endsWith(decimal));
}

/**
 * Junta parte inteira e fracionária em centavos, arredondando meio para longe
 * do zero — a mesma convenção do motor, feita em string para não tocar em float.
 *
 * Mais de duas casas acontece: relatório de custo unitário exporta quatro. O
 * valor é arredondado ao centavo e o chamador decide se avisa.
 */
function paraCentavos(inteiro: string, fracao: string): bigint | null {
  try {
    const centavosInteiros = BigInt(inteiro) * 100n;
    const duasCasas = fracao.padEnd(CASAS_DECIMAIS_ESPERADAS, '0');
    const centavosFracao = BigInt(duasCasas.slice(0, CASAS_DECIMAIS_ESPERADAS) || '0');
    const proximaCasa = duasCasas.charCodeAt(CASAS_DECIMAIS_ESPERADAS) - 48;
    const arredonda = proximaCasa >= 5 ? 1n : 0n;
    return centavosInteiros + centavosFracao + arredonda;
  } catch {
    return null;
  }
}

/** Quantas casas decimais o texto trazia, para o aviso de valor não-monetário. */
export function casasDecimais(bruto: string, decimal: SeparadorDecimal): number {
  const fracao = bruto.trim().split(decimal)[1];
  if (fracao === undefined) return 0;
  const digitos = /^\d+/.exec(fracao);
  return digitos ? digitos[0].length : 0;
}

function normalizado(texto: string): string {
  return texto.toLowerCase().trim();
}
