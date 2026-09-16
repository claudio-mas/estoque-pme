/**
 * O formulário do mapeamento vira `Mapeamento` — e pendente não vira entrada.
 */
import { describe, expect, it } from 'vitest';
import {
  mapeamentoDoFormulario,
  paraFormulario,
} from '../src/app/empresas/[id]/mapeamento/decisoes';
import type { Decisao } from '@estoque-pme/mapeamento';

function formulario(campos: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    for (const item of Array.isArray(v) ? v : [v]) f.append(k, item);
  }
  return f;
}

describe('mapeamento a partir do formulário', () => {
  it('monta entradas classificadas e ignoradas, e deixa pendente de fora', () => {
    const lido = mapeamentoDoFormulario(
      formulario({
        'd:1.1.3.01': 'estoque:MP',
        'n:1.1.3.01': 'MATÉRIAS-PRIMAS',
        'd:1.1.1': 'ignorada',
        'n:1.1.1': 'DISPONÍVEL',
        'd:1.1.3.04': 'pendente',
        'n:1.1.3.04': 'INSUMOS DIVERSOS',
        'd:4.1.1.01': 'cmv',
        'n:4.1.1.01': 'CMV',
        ausente: ['PP'],
      }),
    );
    if (!lido.ok) throw new Error(lido.erro);
    expect(lido.mapeamento.niveisAusentes).toEqual(['PP']);
    expect(lido.mapeamento.entradas.map((e) => e.codigo)).toEqual(['1.1.3.01', '1.1.1', '4.1.1.01']);
    expect(lido.mapeamento.entradas[0]?.decisao).toEqual({
      estado: 'classificada',
      papel: { papel: 'estoque', nivel: 'MP' },
    });
    expect(lido.mapeamento.entradas[1]?.decisao).toEqual({ estado: 'ignorada' });
  });

  it('recusa decisão que não está no vocabulário', () => {
    const lido = mapeamentoDoFormulario(formulario({ 'd:1.1.3.01': 'estoque:XX' }));
    expect(lido.ok).toBe(false);
  });

  it('ida e volta do vocabulário para toda decisão', () => {
    const decisoes: readonly Decisao[] = [
      { estado: 'ignorada' },
      { estado: 'classificada', papel: { papel: 'baixa', nivel: 'PA' } },
      { estado: 'classificada', papel: { papel: 'receita' } },
    ];
    for (const d of decisoes) {
      const lido = mapeamentoDoFormulario(formulario({ 'd:x': paraFormulario(d), 'n:x': 'X' }));
      if (!lido.ok) throw new Error(lido.erro);
      expect(lido.mapeamento.entradas[0]?.decisao).toEqual(d);
    }
  });
});
