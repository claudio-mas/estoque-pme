'use client';

import { useActionState } from 'react';
import { importar } from './acoes';
import type { EstadoDaImportacao } from './acoes';

/** ERPs que a PME brasileira de alimentos costuma rodar. Chute informado, a ser corrigido pelo D8. */
const ERPS_CONHECIDOS = [
  'Totvs Protheus',
  'Sankhya',
  'Omie',
  'Domínio',
  'Alterdata',
  'Conta Azul',
  'Bling',
];

const INICIAL: EstadoDaImportacao = { resultados: [], erro: null };

export function Formulario({
  empresaId,
  origemAnterior,
  podeEscrever,
}: {
  empresaId: string;
  origemAnterior: string | null;
  podeEscrever: boolean;
}) {
  const [estado, agir, pendente] = useActionState(importar, INICIAL);

  return (
    <div className="flex flex-col gap-6">
      <form action={agir} className="flex flex-col gap-4 rounded border border-stone-200 bg-white p-4">
        <input type="hidden" name="empresaId" value={empresaId} />

        <label className="flex flex-col gap-1 text-sm">
          Sistema de origem
          <input
            name="origem"
            list="erps"
            required
            defaultValue={origemAnterior ?? ''}
            placeholder="O ERP que exportou os arquivos"
            className="rounded border border-stone-300 px-3 py-2"
          />
          <datalist id="erps">
            {ERPS_CONHECIDOS.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
          <span className="text-xs text-stone-500">
            Obrigatório na primeira importação. Fica registrado em cada arquivo importado.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Arquivos — balancetes e razões, CSV ou XLSX, quantos quiser
          <input
            type="file"
            name="arquivos"
            multiple
            required
            accept=".csv,.txt,.xlsx"
            className="rounded border border-stone-300 px-3 py-2"
          />
          <span className="text-xs text-stone-500">
            O produto descobre qual é qual pelo cabeçalho. Não é preciso separar.
          </span>
        </label>

        <button
          type="submit"
          disabled={pendente || !podeEscrever}
          className="self-start rounded bg-stone-900 px-3 py-2 text-white hover:bg-stone-700 disabled:opacity-50"
        >
          {pendente ? 'Importando…' : 'Importar'}
        </button>
        {!podeEscrever ? (
          <p className="text-xs text-amber-700">Seu papel nesta empresa é de leitura.</p>
        ) : null}
      </form>

      {estado.erro ? <p className="text-sm text-red-700">{estado.erro}</p> : null}

      {estado.resultados.length > 0 ? (
        <table className="w-full rounded border border-stone-200 bg-white text-sm">
          <thead className="bg-stone-100 text-left text-xs uppercase tracking-wide text-stone-600">
            <tr>
              <th className="px-3 py-2">Arquivo</th>
              <th className="px-3 py-2">Artefato</th>
              <th className="px-3 py-2">Competência</th>
              <th className="px-3 py-2">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {estado.resultados.map((r) => (
              <tr key={r.nome} className="border-t border-stone-200 align-top">
                <td className="px-3 py-2">{r.nome}</td>
                <td className="px-3 py-2">{r.artefato ?? '—'}</td>
                <td className="px-3 py-2">{r.competencia ?? '—'}</td>
                <td className="px-3 py-2">
                  {r.resumo ? (
                    <span>
                      {r.resumo.criadas} criadas, {r.resumo.atualizadas} atualizadas ·{' '}
                      {r.resumo.apuracao.estado === 'apurado' ? 'apurado' : 'importado, sem apuração'}
                      {r.avisos > 0 ? ` · ${r.avisos} aviso(s)` : ''}
                    </span>
                  ) : null}
                  {r.erros.map((e) => (
                    <p key={e} className="text-red-700">
                      {e}
                    </p>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
