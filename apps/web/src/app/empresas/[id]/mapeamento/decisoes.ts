/**
 * Como uma decisão viaja no formulário: um valor por `<select>`.
 *
 * Módulo próprio, sem `'use server'`: aquele arquivo só pode exportar actions,
 * e este vocabulário é usado pela página, pelo formulário e pela action.
 */
import type { Decisao, EntradaDeMapeamento, Mapeamento } from '@estoque-pme/mapeamento';
import type { Nivel } from '@estoque-pme/motor-calculo';

export const DECISOES = [
  'pendente',
  'ignorada',
  'estoque:MP',
  'estoque:PP',
  'estoque:PA',
  'baixa:MP',
  'baixa:PP',
  'baixa:PA',
  'cmv',
  'receita',
] as const;
export type DecisaoDoFormulario = (typeof DECISOES)[number];

export function paraFormulario(decisao: Decisao): DecisaoDoFormulario {
  if (decisao.estado === 'ignorada') return 'ignorada';
  const { papel } = decisao;
  if (papel.papel === 'estoque' || papel.papel === 'baixa') return `${papel.papel}:${papel.nivel}`;
  return papel.papel;
}

export function doFormulario(valor: DecisaoDoFormulario): Decisao | null {
  if (valor === 'pendente') return null;
  if (valor === 'ignorada') return { estado: 'ignorada' };
  if (valor === 'cmv' || valor === 'receita') {
    return { estado: 'classificada', papel: { papel: valor } };
  }
  const [papel, nivel] = valor.split(':') as ['estoque' | 'baixa', Nivel];
  return { estado: 'classificada', papel: { papel, nivel } };
}


/** Uma conta como a tela a mostra: o que já foi decidido, ou o que se propõe. */
export interface ContaNaTela {
  readonly codigo: string;
  readonly descricao: string;
  readonly grau: number;
  readonly sintetica: boolean;
  readonly atual: DecisaoDoFormulario;
  /** A sugestão, quando a conta está pendente e o produto tem uma. */
  readonly sugestao: { readonly decisao: DecisaoDoFormulario; readonly motivo: string } | null;
  /** O produto viu o conflito e não propõe — e diz por quê. */
  readonly incoerente: string | null;
  /**
   * Nem decidida nem pendente: coberta por decisão acima (posse de subárvore)
   * ou abaixo (sintética cujos filhos já foram decididos). Não se classifica —
   * classificá-la seria a sobreposição que o ADR-0002 recusa.
   */
  readonly coberta: boolean;
}


/**
 * O `Mapeamento` que o formulário descreve, ou o que estava errado nele.
 *
 * Lê os campos `d:<codigo>` (decisão), `n:<codigo>` (descrição vista) e
 * `ausente` (níveis). Contas `pendente` não viram entrada — pendente é a
 * ausência de decisão, não uma decisão.
 */
export function mapeamentoDoFormulario(
  dados: FormData,
): { readonly ok: true; readonly mapeamento: Mapeamento } | { readonly ok: false; readonly erro: string } {
  const niveis = new Set<Nivel>();
  for (const v of dados.getAll('ausente')) {
    if (v !== 'MP' && v !== 'PP' && v !== 'PA') return { ok: false, erro: `Nível inválido: ${String(v)}.` };
    niveis.add(v);
  }

  const entradas: EntradaDeMapeamento[] = [];
  for (const [chave, valor] of dados.entries()) {
    if (!chave.startsWith('d:') || typeof valor !== 'string') continue;
    const codigo = chave.slice(2).trim();
    if (codigo === '') return { ok: false, erro: 'Conta sem código no formulário.' };
    if (!(DECISOES as readonly string[]).includes(valor)) {
      return { ok: false, erro: `Decisão inválida para ${codigo}: ${valor}.` };
    }
    const decisao = doFormulario(valor as DecisaoDoFormulario);
    if (decisao === null) continue;
    const descricao = dados.get(`n:${codigo}`);
    entradas.push({ codigo, descricao: typeof descricao === 'string' ? descricao : '', decisao });
  }

  return { ok: true, mapeamento: { entradas, niveisAusentes: [...niveis] } };
}
