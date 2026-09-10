/**
 * Mapeamento de contas (RF-28).
 *
 * Puro como os outros dois: recebe um balancete já lido e o mapeamento da
 * empresa, devolve o lançamento do período mais diagnósticos. Não abre arquivo,
 * não fala com banco, não sabe o que é uma empresa — a identidade dela e o
 * versionamento do mapeamento são da persistência.
 *
 * O que este pacote resolve é o que o importador declara não ser trabalho dele:
 * dizer que a conta 1.1.3.01 é MP. O PRD chama isso de "a parte difícil do
 * problema", e ela não desaparece com integração de ERP — por isso está na v1.
 */
export type {
  ContaPendente,
  Decisao,
  DiagnosticoDeMapeamento,
  EntradaDeMapeamento,
  Mapeamento,
  PapelDeConta,
  SeveridadeDeMapeamento,
  Sugestao,
} from './tipos';

export { sugerirPapel } from './lexico';

export { MAPEAMENTO_VAZIO, proporMapeamento } from './proposta';

export { validarMapeamento } from './validacao';

export { aplicarMapeamento } from './aplicacao';
export type { OpcoesAplicacao, ResultadoAplicacao } from './aplicacao';

export { classificarContrapartida, comprasDeMp, consumoDoNivel } from './consumo';
export type { Contrapartida } from './consumo';

export { descendeDe, paiDe, pertenceA, topos } from './subarvore';
