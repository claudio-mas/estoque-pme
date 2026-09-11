/**
 * Persistência: schema, codecs e RLS.
 *
 * **Não é um pacote puro**, e isso é deliberado: tem Drizzle e Postgres. A
 * regra do D11 é sobre o **motor de cálculo**, que continua sem dependência
 * nenhuma e rodando igual nos dois lados.
 *
 * O que este pacote ainda não faz: escrever. Importação em transação única,
 * upsert do balancete e o resumo do RF-05 vêm depois — aqui estão o schema, as
 * invariantes que o banco registra e o codec que atravessa a fronteira.
 */
export * as schema from './schema';
export { TABELAS_DE_DOMINIO } from './schema';

export {
  centavos,
  checkDeAncora,
  checkDeCompetencia,
  checkDeMotivo,
  colunasDeAncora,
  colunasDeCompetencia,
  colunasDeMotivo,
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
