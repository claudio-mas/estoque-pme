import Link from 'next/link';
import { naEmpresaOu404 } from '@/servidor/acesso';
import { serieDaEmpresa } from '@/servidor/serie';
import type { LinhaDaSerie } from '@/servidor/serie';
import { mensagemDoMotivo } from '@estoque-pme/motor-calculo';
import type { Nivel, Perda, Pme } from '@estoque-pme/motor-calculo';

const NIVEIS: readonly Nivel[] = ['MP', 'PP', 'PA'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const dias = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

/**
 * Cada estado com o nome dele, nunca um traço mudo: `ausente` é decisão da
 * empresa, `indefinido` carrega o motivo, `não medido` é a D7. Um "—" genérico
 * apagaria a distinção que o modelo inteiro existe para manter.
 */
function CelulaPme({ pme }: { pme: Pme | undefined }) {
  if (pme === undefined) return <td className="px-3 py-2 text-stone-400">·</td>;
  switch (pme.estado) {
    case 'calculado':
      return (
        <td className="px-3 py-2 text-right tabular-nums" title={`base: ${pme.base}`}>
          {dias.format(pme.dias)}
          {pme.base === 'fechamento' ? <span className="text-stone-400"> *</span> : null}
        </td>
      );
    case 'ausente':
      return <td className="px-3 py-2 text-right text-stone-400">ausente</td>;
    case 'indefinido':
      return (
        <td className="px-3 py-2 text-right text-amber-700" title={mensagemDoMotivo(pme.motivo)}>
          indefinido
        </td>
      );
  }
}

function CelulaPerda({ perda }: { perda: Perda | undefined }) {
  if (perda === undefined) return <td className="px-3 py-2 text-stone-400">·</td>;
  return perda.estado === 'medido' ? (
    <td className="px-3 py-2 text-right tabular-nums">{pct.format(perda.taxa)}</td>
  ) : (
    <td className="px-3 py-2 text-right text-stone-400">não medido</td>
  );
}

function Linha({ linha, base }: { linha: LinhaDaSerie; base: string }) {
  const { ano, mes } = linha.competencia;
  const rotulo = `${MESES[mes - 1]}/${ano}`;
  const href = `${base}/periodos/${ano}/${mes}`;

  if (linha.estado === 'importado') {
    return (
      <tr className="border-t border-stone-200 text-stone-500">
        <td className="px-3 py-2">
          <Link href={href} className="hover:underline">{rotulo}</Link>
        </td>
        <td className="px-3 py-2" colSpan={7}>
          importado, sem apuração — o mapeamento ainda não resolve este período
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-stone-200">
      <td className="px-3 py-2">
        <Link href={href} className="hover:underline">{rotulo}</Link>
      </td>
      {NIVEIS.map((n) => <CelulaPme key={n} pme={linha.pme[n]} />)}
      <td className="px-3 py-2 text-right tabular-nums">
        {linha.cobertura?.estado === 'calculado' ? (
          dias.format(linha.cobertura.dias)
        ) : (
          <span className="text-amber-700" title={linha.cobertura ? mensagemDoMotivo(linha.cobertura.motivo) : ''}>
            indefinida
          </span>
        )}
      </td>
      {NIVEIS.map((n) => <CelulaPerda key={n} perda={linha.perda[n]} />)}
    </tr>
  );
}

export default async function Periodos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const serie = await naEmpresaOu404(id, ({ tx }) => serieDaEmpresa(tx, id));
  const base = `/empresas/${id}`;

  if (serie.length === 0) {
    return (
      <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">
        Nenhum período ainda. <Link href={`${base}/importar`} className="underline">Importe o primeiro balancete</Link>.
      </p>
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">Períodos</h2>
      <div className="overflow-x-auto rounded border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-100 text-left text-xs uppercase tracking-wide text-stone-600">
            <tr>
              <th className="px-3 py-2">Competência</th>
              <th className="px-3 py-2 text-right">PME MP</th>
              <th className="px-3 py-2 text-right">PME PP</th>
              <th className="px-3 py-2 text-right">PME PA</th>
              <th className="px-3 py-2 text-right">Cobertura</th>
              <th className="px-3 py-2 text-right">Perda MP</th>
              <th className="px-3 py-2 text-right">Perda PP</th>
              <th className="px-3 py-2 text-right">Perda PA</th>
            </tr>
          </thead>
          <tbody>
            {serie.map((linha) => (
              <Linha key={`${linha.competencia.ano}-${linha.competencia.mes}`} linha={linha} base={base} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Dias de consumo. <span className="text-stone-400">*</span> = calculado sobre o saldo de fechamento, por não haver saldo anterior (D5).
      </p>
    </section>
  );
}
