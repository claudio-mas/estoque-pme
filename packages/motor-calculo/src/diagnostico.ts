/**
 * Onde um problema está, e por que um cálculo não tem resposta.
 *
 * Duas coisas moram aqui porque as duas são vocabulário de domínio, não
 * mecânica de arquivo: a **âncora** é o que torna um aviso navegável (RF-28,
 * RF-29), e o **motivo** é a razão de um cálculo não ter resposta. Os dois são
 * usados pelo importador, pelo mapeamento e pelo próprio motor — e antes de
 * morarem aqui, dois códigos já existiam nos dois pacotes com significados
 * diferentes (`conta-sem-codigo`, `movimento-ilegivel`). Vocabulário duplicado
 * diverge em silêncio; é para isso que ele é um só.
 */
import type { Nivel } from './tipos';

export type Severidade = 'erro' | 'aviso' | 'info';

/**
 * O que um problema aponta.
 *
 * Substitui o par `linha`/`coluna` que servia só ao arquivo. Um problema de
 * mapeamento não é de uma linha — é de uma **conta**, e vale em todo arquivo em
 * que ela aparecer. Um campo obrigatório permanentemente nulo seria o tipo
 * dizendo que não é esse tipo.
 *
 * `nivel` é qualificador opcional da conta porque existe o caso real de uma
 * conta pendente que deixa **um nível** em dúvida: sem ele, a mensagem perderia
 * metade do assunto.
 */
export type Ancora =
  | { readonly tipo: 'arquivo' }
  | { readonly tipo: 'mapeamento' }
  /** `linha` é 1-based e conta linhas físicas — é o número que o gestor vê no Excel. */
  | { readonly tipo: 'linha'; readonly linha: number; readonly coluna?: string }
  | { readonly tipo: 'conta'; readonly conta: string; readonly nivel?: Nivel }
  | { readonly tipo: 'nivel'; readonly nivel: Nivel }
  /** Um lançamento do razão: a conta e a linha em que ele está. */
  | { readonly tipo: 'lancamento'; readonly conta: string; readonly linha: number };

/**
 * Por que um cálculo não tem resposta.
 *
 * Conjunto fechado, e pequeno de propósito: nenhum destes fala de codificação,
 * delimitador ou coluna — isso é mecânica de leitura, e o importador tem o
 * vocabulário dele. Estes são os motivos que o gestor lê num relatório.
 */
export type CodigoDeMotivo =
  | 'custo-direcionador-zerado'
  | 'custo-direcionador-negativo'
  | 'nenhum-nivel-movimentado'
  | 'pme-indefinido'
  | 'nivel-nao-mapeado'
  | 'nivel-incompleto'
  | 'saldo-de-fechamento-ausente'
  | 'sem-razao'
  | 'razao-sem-conta-do-nivel'
  | 'contrapartida-ausente'
  | 'contrapartida-pendente'
  | 'sem-razao-nem-informado';

/**
 * A razão de um cálculo não ter resposta, navegável até a origem.
 *
 * Código mais âncora, nunca frase pronta (ADR-0008): o histórico não carrega a
 * redação de hoje, e o aviso tem para onde navegar — a conta está num campo, e
 * não dentro de uma string.
 */
export interface Motivo {
  readonly codigo: CodigoDeMotivo;
  readonly ancora: Ancora;
}

/** Constrói um motivo ancorado num nível. */
export function motivoDoNivel(codigo: CodigoDeMotivo, nivel: Nivel): Motivo {
  return { codigo, ancora: { tipo: 'nivel', nivel } };
}

/** Constrói um motivo ancorado numa conta, opcionalmente dentro de um nível. */
export function motivoDaConta(codigo: CodigoDeMotivo, conta: string, nivel?: Nivel): Motivo {
  return {
    codigo,
    ancora: nivel === undefined ? { tipo: 'conta', conta } : { tipo: 'conta', conta, nivel },
  };
}

/** Onde o problema está, em português, para entrar no meio de uma frase. */
export function ondeEsta(ancora: Ancora): string {
  switch (ancora.tipo) {
    case 'arquivo':
      return 'no arquivo';
    case 'mapeamento':
      return 'no mapeamento de contas';
    case 'linha':
      return ancora.coluna === undefined
        ? `na linha ${ancora.linha}`
        : `na linha ${ancora.linha}, coluna ${ancora.coluna}`;
    case 'conta':
      return ancora.nivel === undefined
        ? `na conta ${ancora.conta}`
        : `na conta ${ancora.conta}, de ${ancora.nivel}`;
    case 'nivel':
      return `em ${ancora.nivel}`;
    case 'lancamento':
      return `no lançamento da linha ${ancora.linha}, na conta ${ancora.conta}`;
  }
}

/**
 * A frase que o gestor lê.
 *
 * `switch` exaustivo de propósito: o compilador cobra a tradução de todo código
 * novo, que é a garantia que separar código de frase existe para dar.
 */
export function mensagemDoMotivo(motivo: Motivo): string {
  const onde = ondeEsta(motivo.ancora);

  switch (motivo.codigo) {
    case 'custo-direcionador-zerado':
      return `Custo direcionador zerado no período, ${onde}.`;
    case 'custo-direcionador-negativo':
      return `Custo direcionador negativo no período, ${onde}.`;
    case 'nenhum-nivel-movimentado':
      return 'Nenhum nível movimentado no período.';
    case 'pme-indefinido':
      return `PME indefinido ${onde}; a cobertura não fecha sem ele.`;
    case 'nivel-nao-mapeado':
      return `Nenhuma conta classificada como estoque ${onde}, e o nível não foi declarado ausente.`;
    case 'nivel-incompleto':
      return `O estoque não é conhecido por inteiro: há conta pendente ${onde}.`;
    case 'saldo-de-fechamento-ausente':
      return `O arquivo não traz saldo de fechamento ${onde}.`;
    case 'sem-razao':
      return `Sem razão, o consumo não é medido ${onde}.`;
    case 'razao-sem-conta-do-nivel':
      return `O razão não traz nenhuma das contas classificadas como estoque ${onde}.`;
    case 'contrapartida-ausente':
      return `Consumo não derivado: não há contrapartida ${onde}.`;
    case 'contrapartida-pendente':
      return `Consumo não derivado: a contrapartida ${onde} não está classificada nem ignorada.`;
    case 'sem-razao-nem-informado':
      return 'Sem razão da conta de MP e sem valor informado: o custo de materiais não é linha de balancete nem de DRE.';
  }
}
