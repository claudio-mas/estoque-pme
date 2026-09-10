/**
 * A proposta de classificação: léxico da descrição, código como reforço.
 *
 * Nenhum dos dois sozinho serve. O léxico classificaria corretamente "PERDAS E
 * QUEBRAS" e classificaria também uma conta de despesa chamada "PERDAS COM
 * CLIENTES"; o código sozinho não sobrevive a plano de contas que não segue a
 * estrutura clássica. Juntos, a incoerência entre os dois vira o sinal mais
 * útil que existe — *não proponho, e digo por quê*.
 *
 * O léxico é constante do pacote, igual para toda empresa. Aprender dos
 * mapeamentos já confirmados é a coisa certa a construir **depois**: depende de
 * dado acumulado que ainda não existe, que é o próprio argumento do D8.
 */
import { normalizar } from '@estoque-pme/importador';
import type { Nivel } from '@estoque-pme/motor-calculo';
import type { PapelDeConta, Sugestao } from './tipos';

/**
 * Termos de baixa, verificados **antes** dos de estoque.
 *
 * A ordem não é estilo: "PERDAS DE MATÉRIA-PRIMA" casa nas duas listas, e quem
 * ganhar decide se aquele dinheiro é estoque ou quebra. Baixa primeiro.
 */
const TERMOS_DE_BAIXA: readonly string[] = [
  'perda',
  'perdas',
  'quebra',
  'quebras',
  'avaria',
  'avarias',
  'validade',
  'vencimento',
  'vencidos',
  'descarte',
  'deterioracao',
  'baixa por perda',
];

const TERMOS_POR_NIVEL: Readonly<Record<Nivel, readonly string[]>> = {
  MP: [
    'materia prima',
    'materias primas',
    'materia',
    'materias',
    'insumo',
    'insumos',
    'embalagem',
    'embalagens',
    'almoxarifado',
    'mp',
  ],
  PP: [
    'produto em processo',
    'produtos em processo',
    'em processo',
    'em elaboracao',
    'semiacabado',
    'semiacabados',
    'producao em andamento',
    'pp',
  ],
  PA: [
    'produto acabado',
    'produtos acabados',
    'acabado',
    'acabados',
    'produto pronto',
    'produtos prontos',
    'pa',
  ],
};

const TERMOS_DE_CMV: readonly string[] = [
  'custo das mercadorias vendidas',
  'custo dos produtos vendidos',
  'custo das vendas',
  'custo de vendas',
  'cmv',
  'cpv',
];

/**
 * `vendas` sozinho está fora de propósito.
 *
 * Ele casaria em "IMPOSTOS SOBRE VENDAS", "DESPESAS COM VENDAS" e "COMISSÕES
 * SOBRE VENDAS", que são contas de resultado no mesmo grupo da receita — a
 * coerência de código não salvaria nenhuma das três. Uma conta chamada apenas
 * "VENDAS" fica sem sugestão e o gestor a classifica uma vez; não sugerir é
 * sempre melhor do que sugerir errado numa tela feita para receber confirmação.
 */
const TERMOS_DE_RECEITA: readonly string[] = [
  'receita de vendas',
  'receita bruta',
  'receita liquida',
  'faturamento',
  'venda de produtos',
  'vendas de produtos',
  'vendas de mercadorias',
  'receita',
  'receitas',
];

/** Grupo do plano de contas: o primeiro dígito do código. */
function grupoDe(codigo: string): string | null {
  const primeiro = codigo.trim().charAt(0);
  return /[0-9]/.test(primeiro) ? primeiro : null;
}

/**
 * Casa um termo como palavra, nunca como pedaço de palavra.
 *
 * Sem isto, "pa" casaria dentro de "PAGAMENTOS" e "mp" dentro de "IMPOSTOS", e
 * a proposta viraria ruído exatamente nas siglas que mais aparecem em plano de
 * contas enxuto.
 */
function contem(texto: string, termo: string): boolean {
  return ` ${texto} `.includes(` ${termo} `);
}

function primeiroTermo(texto: string, termos: readonly string[]): string | null {
  for (const termo of termos) {
    if (contem(texto, termo)) return termo;
  }
  return null;
}

/**
 * O grupo do plano de contas em que cada papel é esperado.
 *
 * Estoque é ativo; CMV e receita são contas de resultado, que os planos
 * brasileiros põem em 3 ou em 4 conforme a convenção da empresa. Baixa aceita
 * os dois lados, porque tanto aparece como conta retificadora do ativo quanto
 * como despesa — e o balancete de exemplo traz "PERDAS E QUEBRAS" em 1.1.3.09.
 */
const GRUPOS_ESPERADOS: Readonly<Record<PapelDeConta['papel'], readonly string[]>> = {
  estoque: ['1'],
  baixa: ['1', '3', '4', '5'],
  cmv: ['3', '4', '5'],
  receita: ['3', '4'],
};

function coerente(papel: PapelDeConta, codigo: string): boolean {
  const grupo = grupoDe(codigo);
  if (grupo === null) return true;
  return (GRUPOS_ESPERADOS[papel.papel] as readonly string[]).includes(grupo);
}

function nomeDoPapel(papel: PapelDeConta): string {
  switch (papel.papel) {
    case 'estoque':
      return `estoque de ${papel.nivel}`;
    case 'baixa':
      return `baixa de ${papel.nivel}`;
    case 'cmv':
      return 'CMV';
    case 'receita':
      return 'receita';
  }
}

/** O papel que a descrição sugere, sem ainda olhar o código. */
function papelPelaDescricao(texto: string): { papel: PapelDeConta; termo: string } | null {
  const nivelCasado = (): { nivel: Nivel; termo: string } | null => {
    for (const nivel of ['MP', 'PP', 'PA'] as const) {
      const termo = primeiroTermo(texto, TERMOS_POR_NIVEL[nivel]);
      if (termo !== null) return { nivel, termo };
    }
    return null;
  };

  const termoDeBaixa = primeiroTermo(texto, TERMOS_DE_BAIXA);
  if (termoDeBaixa !== null) {
    const nivel = nivelCasado();
    // Baixa sem nível na descrição não vira sugestão: seria escolher o nível no
    // lugar do gestor, e a perda por nível (RF-13) é medida contra o consumo
    // daquele nível — errar aqui reporta quebra de MP como quebra de PA.
    if (nivel === null) return null;
    return {
      papel: { papel: 'baixa', nivel: nivel.nivel },
      termo: `${termoDeBaixa} + ${nivel.termo}`,
    };
  }

  const termoDeCmv = primeiroTermo(texto, TERMOS_DE_CMV);
  if (termoDeCmv !== null) return { papel: { papel: 'cmv' }, termo: termoDeCmv };

  const nivel = nivelCasado();
  if (nivel !== null) {
    return { papel: { papel: 'estoque', nivel: nivel.nivel }, termo: nivel.termo };
  }

  const termoDeReceita = primeiroTermo(texto, TERMOS_DE_RECEITA);
  if (termoDeReceita !== null) return { papel: { papel: 'receita' }, termo: termoDeReceita };

  return null;
}

/**
 * Propõe um papel para uma conta, ou explica por que não propõe.
 *
 * Nunca aplica sozinha: o aceite do RF-28 diz que conta nova entra como
 * pendente e **nunca** é classificada em silêncio. A sugestão é um campo da
 * pendência, não um quarto estado do mapeamento.
 */
export function sugerirPapel(codigo: string, descricao: string): Sugestao {
  const texto = normalizar(descricao);
  const casado = papelPelaDescricao(texto);
  if (casado === null) return { estado: 'semSugestao' };

  const nome = nomeDoPapel(casado.papel);
  if (!coerente(casado.papel, codigo)) {
    return {
      estado: 'incoerente',
      motivo: `A descrição casa com ${nome} ("${casado.termo}"), mas o código ${codigo} está no grupo ${grupoDe(codigo) ?? '?'} do plano de contas.`,
    };
  }

  return {
    estado: 'sugerido',
    papel: casado.papel,
    motivo: `Descrição casa com ${nome} ("${casado.termo}") e o código ${codigo} está no grupo esperado.`,
  };
}
