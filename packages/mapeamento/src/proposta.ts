/**
 * As contas de um arquivo sobre as quais não há decisão.
 *
 * Pendente não é estado guardado: é a **ausência** de entrada no mapeamento,
 * descoberta confrontando o arquivo com o que já foi decidido. É o que faz
 * "conta nova entra como pendente" (RF-28) acontecer por construção, sem
 * ninguém precisar lembrar de inserir nada.
 */
import type { LinhaBalancete } from '@estoque-pme/importador';
import { sugerirPapel } from './lexico';
import { descendeDe, pertenceA } from './subarvore';
import type { ContaPendente, Mapeamento } from './tipos';

/** Mapeamento de empresa que ainda não classificou nada. */
export const MAPEAMENTO_VAZIO: Mapeamento = { entradas: [], niveisAusentes: [] };

/**
 * Verdadeiro quando já há decisão respondendo por esta conta.
 *
 * Duas direções, e as duas importam. **Para cima**: uma entrada ancestral
 * responde pela conta, inclusive quando é ignorada — ignorar `1.1.1` leva a
 * subárvore junto, contas futuras incluídas (ADR-0002). **Para baixo**: a
 * sintética que já tem descendente decidido não é pendente, porque num
 * balancete o saldo dela é a soma dos filhos e a decisão foi tomada lá embaixo.
 * Sem essa segunda direção, `1`, `1.1` e `1.1.3` ficariam pendentes para sempre
 * e a lista nunca esvaziaria — que é o fracasso que o estado `ignorada` existe
 * para evitar.
 */
function decidida(codigo: string, mapeamento: Mapeamento): boolean {
  return mapeamento.entradas.some(
    (entrada) => pertenceA(codigo, entrada.codigo) || descendeDe(entrada.codigo, codigo),
  );
}

/**
 * Lista as contas pendentes do arquivo, cada uma com a sugestão que o produto
 * propõe — ou com o motivo de não propor nenhuma.
 */
export function proporMapeamento(
  linhas: readonly LinhaBalancete[],
  mapeamento: Mapeamento = MAPEAMENTO_VAZIO,
): readonly ContaPendente[] {
  const pendentes: ContaPendente[] = [];
  const vistos = new Set<string>();

  for (const linha of linhas) {
    if (linha.codigo === '' || vistos.has(linha.codigo)) continue;
    vistos.add(linha.codigo);
    if (decidida(linha.codigo, mapeamento)) continue;

    pendentes.push({
      codigo: linha.codigo,
      descricao: linha.descricao,
      sugestao: sugerirPapel(linha.codigo, linha.descricao),
    });
  }

  return pendentes;
}
