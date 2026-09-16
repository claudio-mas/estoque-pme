/**
 * Importador de balancete.
 *
 * Puro como o motor: recebe os bytes do arquivo e devolve estrutura mais
 * diagnósticos. Não abre arquivo, não fala com banco, não sabe o que é uma
 * empresa. Isso deixa a pré-visualização rodar no navegador com o mesmo código
 * que grava no servidor, e deixa o caso difícil — encoding, delimitador,
 * decimal, layout de ERP — ser testado com bytes literais em vez de arquivo.
 *
 * O que **não** está aqui, de propósito: a semântica das contas. Dizer que a
 * conta 1.1.3.01 é MP é o mapeamento por empresa do RF-28, e não é trabalho de
 * leitura de arquivo.
 */
export type {
  Codificacao,
  ColunasBalancete,
  ColunasRazao,
  Competencia,
  ContaRazao,
  DelimitacaoDeRazao,
  Delimitador,
  Dialeto,
  Diagnostico,
  LancamentoRazao,
  LayoutDeBalancete,
  LayoutDeRazao,
  LinhaBalancete,
  PerfilImportacao,
  ResultadoBalancete,
  ResultadoRazao,
  SeparadorDecimal,
  Severidade,
} from './tipos';

export { lerBalancete, lerBalanceteDeAba } from './balancete';
export type { OpcoesBalancete } from './balancete';

export { lerRazao, lerRazaoDeAba } from './razao';

export { detectarArtefato } from './artefato';
export type { Artefato, ArtefatoDetectado } from './artefato';
export type { OpcoesRazao } from './razao';

export { decodificar, normalizar } from './texto';
export type { TextoDecodificado } from './texto';

export { CASAS_DECIMAIS_ESPERADAS, casasDecimais, lerValor } from './numero';
export type { Natureza, ValorLido } from './numero';

export { lerPlanilha } from './planilha';
export { DECIMAL_DA_PLANILHA } from './aba';
export type { Aba, Planilha } from './aba';

export { lerCsv, vazio } from './csv';
export type { RegistroCsv } from './csv';

export { detectarDecimal, detectarDelimitador, detectarDialeto } from './dialeto';
export type { DialetoDelimitado } from './dialeto';

export { detectarCompetencia } from './competencia';
export { reconhecerCabecalho } from './colunas';
export { reconhecerCabecalhoDeRazao } from './colunas-razao';
export type { CabecalhoDeRazaoReconhecido, PapelDeColunaRazao } from './colunas-razao';
export type { CabecalhoReconhecido, PapelDeColuna } from './colunas';
