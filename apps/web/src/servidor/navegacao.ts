/**
 * Onde um aviso leva.
 *
 * Foi por isto que o `motivo` deixou de ser frase e virou código + âncora
 * (ADR-0008): a conta num campo próprio tem para onde ir; dentro de uma string,
 * não. Aqui a âncora vira um `href` — e o aviso navegável do RF-28 e do RF-29
 * deixa de ser promessa.
 *
 * Puro: sem sessão, sem banco. Uma função, um teste.
 */
import type { Ancora } from '@estoque-pme/motor-calculo';

export interface Destino {
  readonly href: string;
  readonly rotulo: string;
}

/** Os ids que a página do período dá às suas âncoras de destino. */
export const ID_DA_LINHA = (linha: number) => `linha-${linha}`;
export const ID_DO_LANCAMENTO = (conta: string, linha: number) => `razao-${conta}-${linha}`;
/** E o que a página do mapeamento dá a cada conta. */
export const ID_DA_CONTA = (conta: string) => `conta-${conta}`;

export function destinoDa(
  ancora: Ancora,
  empresaId: string,
  competencia: { readonly ano: number; readonly mes: number },
): Destino | null {
  const base = `/empresas/${empresaId}`;
  const periodo = `${base}/periodos/${competencia.ano}/${competencia.mes}`;

  switch (ancora.tipo) {
    case 'arquivo':
    case 'mapeamento':
      // Não há um lugar mais específico que a própria página.
      return null;
    case 'linha':
      return { href: `${periodo}#${ID_DA_LINHA(ancora.linha)}`, rotulo: `linha ${ancora.linha}` };
    case 'conta':
      return {
        href: `${base}/mapeamento#${ID_DA_CONTA(ancora.conta)}`,
        rotulo: ancora.nivel === undefined ? `conta ${ancora.conta}` : `conta ${ancora.conta} (${ancora.nivel})`,
      };
    case 'nivel':
      return { href: `${base}/mapeamento`, rotulo: `nível ${ancora.nivel}` };
    case 'lancamento':
      return {
        href: `${periodo}#${ID_DO_LANCAMENTO(ancora.conta, ancora.linha)}`,
        rotulo: `lançamento da linha ${ancora.linha}, conta ${ancora.conta}`,
      };
  }
}
