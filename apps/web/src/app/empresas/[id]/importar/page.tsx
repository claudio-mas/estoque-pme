import { importacoesDaEmpresa } from '@estoque-pme/dados';
import { naEmpresaOu404 } from '@/servidor/acesso';
import { Formulario } from './formulario';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const quando = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Importar é rápido e repetitivo; classificar é lento e acontece uma vez. São
 * duas páginas de propósito — o RF-28 as separa, e fundi-las faria o mês de
 * rotina passar pela tela de onboarding.
 */
export default async function Importar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { historico, papel } = await naEmpresaOu404(id, async ({ tx, papel }) => ({
    historico: await importacoesDaEmpresa(tx, id),
    papel,
  }));

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h2 className="mb-3 text-lg font-medium">Importar</h2>
        <Formulario
          empresaId={id}
          origemAnterior={historico[0]?.origem ?? null}
          podeEscrever={papel === 'editor'}
        />
      </div>

      {historico.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-stone-700">Importações anteriores</h3>
          <table className="w-full rounded border border-stone-200 bg-white text-sm">
            <thead className="bg-stone-100 text-left text-xs uppercase tracking-wide text-stone-600">
              <tr>
                <th className="px-3 py-2">Quando</th>
                <th className="px-3 py-2">Artefato</th>
                <th className="px-3 py-2">Competência</th>
                <th className="px-3 py-2">Origem</th>
                <th className="px-3 py-2 text-right">Linhas</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((i) => (
                <tr key={i.id} className="border-t border-stone-200">
                  <td className="px-3 py-2">{quando.format(i.em)}</td>
                  <td className="px-3 py-2">{i.artefato}</td>
                  <td className="px-3 py-2">
                    {MESES[i.competencia.mes - 1]}/{i.competencia.ano}
                  </td>
                  <td className="px-3 py-2">{i.origem}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {i.criadas} criadas · {i.atualizadas} atualizadas
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
