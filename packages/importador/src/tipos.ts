/**
 * Tipos da importação.
 *
 * A regra que molda tudo aqui é a do aceite do RF-01: **linha inválida é
 * listada com número e motivo, sem abortar o lote**. Nenhuma função deste
 * pacote lança exceção por dado ruim — dado ruim vira `Diagnostico` e a leitura
 * continua. Exceção aqui é defeito de programação, não arquivo torto.
 */
import type { Centavos, Competencia } from '@estoque-pme/motor-calculo';

export type Severidade = 'erro' | 'aviso' | 'info';

/**
 * Um problema encontrado na leitura, sempre navegável até a origem.
 *
 * `linha` é 1-based e conta linhas físicas do arquivo, não registros — é o
 * número que o gestor vê ao abrir o arquivo no Excel, e sem ele o aviso não
 * serve para nada. `null` quando o problema é do arquivo inteiro.
 */
export interface Diagnostico {
  readonly severidade: Severidade;
  readonly codigo: string;
  readonly mensagem: string;
  readonly linha: number | null;
  readonly coluna?: string;
}

/**
 * Competência mensal: o balancete não traz data por linha, traz no cabeçalho.
 *
 * Definida no motor, porque é vocabulário do domínio e não da importação;
 * reexportada aqui para quem consome só este pacote.
 */
export type { Competencia };

export type Codificacao = 'utf-8' | 'windows-1252' | 'utf-16le' | 'utf-16be';
export type Delimitador = ';' | ',' | '\t' | '|';
export type SeparadorDecimal = ',' | '.';

/** Papéis de coluna que o balancete precisa ter, por índice de coluna. */
export interface ColunasBalancete {
  readonly codigo: number;
  readonly descricao: number;
  readonly saldoAnterior: number | null;
  readonly debito: number | null;
  readonly credito: number | null;
  readonly saldoAtual: number;
}

/**
 * Como uma conta é delimitada no razão.
 *
 * Os dois formatos existem de verdade e não dá para escolher por decreto:
 * `bloco` traz um cabeçalho por conta seguido dos lançamentos dela; `plano`
 * repete o código da conta em coluna própria em toda linha. Qual dos dois é
 * detectado, como o delimitador e o decimal já são.
 */
export type DelimitacaoDeRazao = 'bloco' | 'plano';

/**
 * Papéis de coluna do razão, por índice.
 *
 * Tudo opcional porque o mínimo para o arquivo ser legível é apenas o valor, em
 * qualquer das duas formas: `debito` e `credito` separados, ou `valor` com a
 * coluna de `natureza` D/C ao lado. Faltar `contrapartida` não impede ler — só
 * impede concluir, e essa é outra camada (RF-29).
 */
export interface ColunasRazao {
  /** Código da conta repetido na linha; só existe no formato `plano`. */
  readonly conta: number | null;
  readonly data: number | null;
  readonly historico: number | null;
  readonly debito: number | null;
  readonly credito: number | null;
  /** Coluna única de valor, quando o ERP não separa débito de crédito. */
  readonly valor: number | null;
  /** Natureza D/C que acompanha `valor`. */
  readonly natureza: number | null;
  readonly contrapartida: number | null;
  readonly saldo: number | null;
}

/**
 * O dialeto de um sistema de origem: a metade do perfil que é do **ERP**, não
 * do arquivo. Um ERP não exporta o balancete em Latin-1 e o razão em UTF-8.
 */
export interface Dialeto {
  readonly codificacao: Codificacao;
  readonly delimitador: Delimitador;
  readonly separadorDecimal: SeparadorDecimal;
}

/** A metade do perfil que é do **arquivo**: onde estão as colunas e quais são. */
export interface LayoutDeBalancete {
  /** Índice 0-based da linha de cabeçalho dentro do arquivo. */
  readonly linhaCabecalho: number;
  readonly colunas: ColunasBalancete;
}

export interface LayoutDeRazao {
  readonly linhaCabecalho: number;
  readonly delimitacao: DelimitacaoDeRazao;
  readonly colunas: ColunasRazao;
}

/**
 * O layout de exportação de um sistema de origem (RF-24, D8).
 *
 * Não é um tipo de configuração à parte: é exatamente o que a detecção devolve.
 * Salvar o perfil do primeiro cliente de um ERP é o que faz o segundo importar
 * sem configurar nada — e é o que permite reprocessar um arquivo anos depois
 * exatamente como foi lido na primeira vez.
 *
 * Decomposto em dialeto e layouts porque o perfil é **por sistema de origem** e
 * o ERP exporta mais de um artefato: o dialeto vale para os dois arquivos, cada
 * layout vale para o seu. É o que faz o segundo cliente do mesmo ERP importar
 * sem reconfigurar nada mesmo quando manda o razão antes do balancete.
 */
export interface PerfilImportacao {
  readonly dialeto: Dialeto;
  readonly balancete: LayoutDeBalancete | null;
  readonly razao: LayoutDeRazao | null;
}

/**
 * Uma conta do balancete.
 *
 * Assimetria deliberada entre saldo e movimento: saldo vazio é `null`, porque
 * ausência não é zero e um saldo que não veio no arquivo não é um saldo zerado.
 * Débito e crédito vazios são `0n`, porque em balancete a coluna de movimento
 * em branco significa mesmo "não houve movimento" — é a convenção contábil, não
 * uma lacuna de dados.
 */
export interface LinhaBalancete {
  readonly linha: number;
  readonly codigo: string;
  readonly descricao: string;
  readonly saldoAnterior: Centavos | null;
  readonly debito: Centavos;
  readonly credito: Centavos;
  readonly saldoAtual: Centavos | null;
  /** Profundidade do código no plano de contas: `1.1.3` tem grau 3. */
  readonly grau: number;
  /**
   * Verdadeiro quando outra conta do mesmo arquivo desce a partir desta.
   *
   * Somar sintética e analítica juntas conta o mesmo dinheiro duas vezes. O
   * mapeamento (RF-28) decide o que entra; este campo é o que permite decidir.
   */
  readonly sintetica: boolean;
}

export interface ResultadoBalancete {
  /** `null` quando não foi possível achar a competência no cabeçalho do arquivo. */
  readonly competencia: Competencia | null;
  readonly linhas: readonly LinhaBalancete[];
  readonly diagnosticos: readonly Diagnostico[];
  /** O layout efetivamente usado, pronto para virar perfil de ERP (RF-24). */
  readonly perfil: PerfilImportacao | null;
}

/**
 * Um lançamento do razão.
 *
 * `data` e `historico` não alimentam cálculo nenhum — o produto é mensal e
 * agregado (D1). Ficam porque são **rastro de auditoria**, e a convenção do
 * projeto é que valor financeiro sem trilha não se defende diante de um sócio
 * ou de um banco. A data fica como o arquivo escreveu, sem virar `Date`: não há
 * cálculo que a use, e inventar um interpretador de data de ERP brasileiro
 * criaria um modo de falha novo sem nenhum ganho.
 *
 * `contrapartida` é a conta do outro lado do lançamento, quando o ERP a
 * exporta. É ela que separa consumo de devolução a fornecedor — sem ela o
 * consumo não se deriva (ADR-0005), e é por isso que ela existe aqui apesar de
 * nem sempre vir.
 */
export interface LancamentoRazao {
  readonly linha: number;
  readonly data: string | null;
  readonly historico: string;
  readonly debito: Centavos;
  readonly credito: Centavos;
  readonly contrapartida: string | null;
}

/**
 * Uma conta do razão, com os lançamentos que compõem o movimento do período.
 *
 * Agrupada porque é assim que o arquivo vem: cabeçalho de conta, saldo
 * anterior, lançamentos, saldo atual. Desmanchar esse agrupamento para remontá-
 * lo depois seria desfazer estrutura que o arquivo já traz.
 */
export interface ContaRazao {
  readonly codigo: string;
  readonly descricao: string;
  readonly saldoAnterior: Centavos | null;
  readonly saldoAtual: Centavos | null;
  readonly lancamentos: readonly LancamentoRazao[];
}

export interface ResultadoRazao {
  readonly competencia: Competencia | null;
  readonly contas: readonly ContaRazao[];
  readonly diagnosticos: readonly Diagnostico[];
  readonly perfil: PerfilImportacao | null;
}
