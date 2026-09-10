/**
 * Tipos da importação.
 *
 * A regra que molda tudo aqui é a do aceite do RF-01: **linha inválida é
 * listada com número e motivo, sem abortar o lote**. Nenhuma função deste
 * pacote lança exceção por dado ruim — dado ruim vira `Diagnostico` e a leitura
 * continua. Exceção aqui é defeito de programação, não arquivo torto.
 */
import type { Centavos } from '@estoque-pme/motor-calculo';

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

/** Competência mensal: o balancete não traz data por linha, traz no cabeçalho. */
export interface Competencia {
  readonly ano: number;
  /** 1 a 12. */
  readonly mes: number;
}

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
 * O layout de exportação de um sistema de origem (RF-24, D8).
 *
 * Não é um tipo de configuração à parte: é exatamente o que a detecção devolve.
 * Salvar o perfil do primeiro cliente de um ERP é o que faz o segundo importar
 * sem configurar nada — e é o que permite reprocessar um arquivo anos depois
 * exatamente como foi lido na primeira vez.
 */
export interface PerfilImportacao {
  readonly codificacao: Codificacao;
  readonly delimitador: Delimitador;
  readonly separadorDecimal: SeparadorDecimal;
  /** Índice 0-based da linha de cabeçalho dentro do arquivo. */
  readonly linhaCabecalho: number;
  readonly colunas: ColunasBalancete;
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
