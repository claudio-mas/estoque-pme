/**
 * Persistência: schema, codecs e RLS.
 *
 * **Não é um pacote puro**, e isso é deliberado: tem Drizzle e Postgres. A
 * regra do D11 é sobre o **motor de cálculo**, que continua sem dependência
 * nenhuma e rodando igual nos dois lados.
 *
 * Ele compõe os outros três: lê o que o `importador` produziu, aplica o
 * `mapeamento` e grava. Essa dependência é a natureza dele — é aqui que a
 * escrita mora.
 */
export * as schema from './schema';
export { TABELAS_DE_DOMINIO } from './schema';

export {
  centavos,
  checkDeAncora,
  checkDeCompetencia,
  checkDeMotivo,

  colunasDeCompetencia,

} from './colunas';

export {
  ancoraDeLinha,
  ancoraParaLinha,
  consumoDeLinha,
  consumoParaLinha,
  custoMateriaisDeLinha,
  custoMateriaisParaLinha,
  motivoDeLinha,
  motivoParaLinha,
  perdaDeLinha,
  perdaMedidaDeLinha,
  perdaParaLinha,
  saldoDeLinha,
  saldoParaLinha,
} from './codec';
export type {
  LinhaDeAncora,
  LinhaDeConsumo,
  LinhaDeCustoMateriais,
  LinhaDeMotivo,
  LinhaDePerda,
  LinhaDeSaldo,
} from './codec';

export { EMPRESA_CORRENTE, ISOLAMENTO, sqlDeRls } from './rls';

export { comEmpresa } from './banco';
export type { Banco, Transacao } from './banco';

export { apurarEmpresa, apurarPeriodo, mapeamentoCorrente } from './apuracao';
export type { ResultadoApuracao } from './apuracao';

export { importarBalancete, importarRazao } from './importacao';
export type { DadosDaImportacao, ResumoDaImportacao } from './importacao';

export { periodosDefasados, salvarMapeamento, salvarValorInformado } from './edicao';
export type { Edicao, ResultadoDaEdicao } from './edicao';
