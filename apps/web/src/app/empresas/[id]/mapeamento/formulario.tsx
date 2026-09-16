'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Nivel } from '@estoque-pme/motor-calculo';
import { salvar } from './acoes';
import type { EstadoDoMapeamento } from './acoes';
import type { ContaNaTela, DecisaoDoFormulario } from './decisoes';

const NIVEIS: readonly Nivel[] = ['MP', 'PP', 'PA'];

const ROTULOS: Readonly<Record<DecisaoDoFormulario, string>> = {
  pendente: '— pendente —',
  ignorada: 'Ignorar esta conta',
  'estoque:MP': 'Estoque de MP',
  'estoque:PP': 'Estoque de PP',
  'estoque:PA': 'Estoque de PA',
  'baixa:MP': 'Baixa (perda) de MP',
  'baixa:PP': 'Baixa (perda) de PP',
  'baixa:PA': 'Baixa (perda) de PA',
  cmv: 'CMV',
  receita: 'Receita',
};

const INICIAL: EstadoDoMapeamento = { versao: null, periodosReapurados: 0, erros: [], avisos: [] };

export function Formulario({
  empresaId,
  contas,
  ausentes,
  podeEscrever,
}: {
  empresaId: string;
  contas: readonly ContaNaTela[];
  ausentes: readonly Nivel[];
  podeEscrever: boolean;
}) {
  const [estado, agir, pendente] = useActionState(salvar, INICIAL);
  const router = useRouter();
  const pendentes = contas.filter((c) => !c.coberta && (c.atual === 'pendente' || c.sugestao !== null)).length;

  // Salvar reapura no servidor; as props desta tela são da renderização
  // inicial. Sem o refresh, a conta recém-ignorada continuaria "pendente" na
  // tela até um reload à mão — e o gestor não saberia se salvou.
  useEffect(() => {
    if (estado.versao !== null) router.refresh();
  }, [estado.versao, router]);

  return (
    <form action={agir} className="flex flex-col gap-4">
      <input type="hidden" name="empresaId" value={empresaId} />

      {estado.versao !== null ? (
        <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Versão {estado.versao} salva. {estado.periodosReapurados} período(s) reapurado(s).
        </p>
      ) : null}
      {estado.erros.map((e) => (
        <p key={e} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {e}
        </p>
      ))}
      {estado.avisos.map((a) => (
        <p key={a} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {a}
        </p>
      ))}

      <fieldset className="flex flex-wrap items-center gap-4 rounded border border-stone-200 bg-white p-3 text-sm">
        <legend className="px-1 text-xs uppercase tracking-wide text-stone-600">
          Níveis que a empresa não movimenta
        </legend>
        {NIVEIS.map((n) => (
          <label key={n} className="flex items-center gap-2">
            <input type="checkbox" name="ausente" value={n} defaultChecked={ausentes.includes(n)} />
            {n} ausente
          </label>
        ))}
        <span className="text-xs text-stone-500">
          Declarar ausente não basta se houver conta pendente com a cara do nível — ela precisa ser
          ignorada.
        </span>
      </fieldset>

      <div className="overflow-x-auto rounded border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-100 text-left text-xs uppercase tracking-wide text-stone-600">
            <tr>
              <th className="px-3 py-2">Conta</th>
              <th className="px-3 py-2">Descrição</th>
              <th className="px-3 py-2">Papel</th>
              <th className="px-3 py-2">Por quê</th>
            </tr>
          </thead>
          <tbody>
            {contas.map((c) => (
              <tr key={c.codigo} className={`border-t border-stone-200 ${c.sintetica ? 'text-stone-500' : ''}`}>
                <td className="px-3 py-2 font-mono text-xs" style={{ paddingLeft: `${0.75 + (c.grau - 1) * 0.75}rem` }}>
                  {c.codigo}
                </td>
                <td className="px-3 py-2">
                  {c.descricao}
                  {c.coberta ? null : <input type="hidden" name={`n:${c.codigo}`} value={c.descricao} />}
                </td>
                <td className="px-3 py-2">
                  {c.coberta ? (
                    <span className="text-xs text-stone-400" title="Coberta por decisão acima ou abaixo dela; não se classifica.">
                      coberta
                    </span>
                  ) : (
                    <select
                      name={`d:${c.codigo}`}
                      defaultValue={c.atual}
                      disabled={!podeEscrever}
                      className={`rounded border px-2 py-1 ${c.atual === 'pendente' ? 'border-amber-400' : 'border-stone-300'}`}
                    >
                      {(Object.keys(ROTULOS) as DecisaoDoFormulario[]).map((d) => (
                        <option key={d} value={d}>
                          {ROTULOS[d]}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="max-w-md px-3 py-2 text-xs text-stone-500">
                  {c.sugestao ? `Proposto: ${c.sugestao.motivo}` : null}
                  {c.incoerente ? <span className="text-amber-700">{c.incoerente}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded border border-stone-200 bg-white p-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Motivo desta versão (opcional)
          <input name="motivo" maxLength={200} className="rounded border border-stone-300 px-3 py-2" />
        </label>
        <button
          type="submit"
          disabled={pendente || !podeEscrever}
          className="rounded bg-stone-900 px-3 py-2 text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {pendente ? 'Salvando e reapurando…' : 'Salvar mapeamento'}
        </button>
      </div>
      <p className="text-xs text-stone-500">
        {pendentes > 0
          ? `${pendentes} conta(s) com proposta ou pendência. Salvar grava uma versão e reapura o histórico inteiro.`
          : 'Nenhuma pendência. Salvar grava uma versão nova mesmo assim.'}
      </p>
    </form>
  );
}
