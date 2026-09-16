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

export { EH_EDITOR, EMPRESA_CORRENTE, ISOLAMENTO, USUARIO_CORRENTE, sqlDeRls } from './rls';

export { comEmpresa, comUsuario } from './banco';
export type { Banco, Escopo, Transacao } from './banco';

export { lancamentosDaEmpresa } from './leitura';
export type { PeriodoLido } from './leitura';

export { semear, vincular } from './semente';

export { empresasDoUsuario, vinculoDe } from './acesso';
export type { Papel, Vinculo } from './acesso';

export { SQL_DO_PAPEL_DA_APLICACAO, sqlDasMigracoes } from './migracoes';
export type { Semeado, Semente } from './semente';

export { apurarEmpresa, apurarPeriodo, mapeamentoCorrente } from './apuracao';
export type { ResultadoApuracao } from './apuracao';

export { importarBalancete, importarRazao } from './importacao';
export type { DadosDaImportacao, ResumoDaImportacao } from './importacao';

export { periodosDefasados, salvarMapeamento, salvarValorInformado } from './edicao';
export type { Edicao, ResultadoDaEdicao } from './edicao';
