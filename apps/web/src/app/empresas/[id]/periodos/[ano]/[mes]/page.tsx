import Link from 'next/link';
import { notFound } from 'next/navigation';
import { periodoDetalhado } from '@estoque-pme/dados';
import type { DiagnosticoLido } from '@estoque-pme/dados';
import { mensagemDoMotivo } from '@estoque-pme/motor-calculo';
import type { Lancamento, Nivel } from '@estoque-pme/motor-calculo';
import { naEmpresaOu404 } from '@/servidor/acesso';
import { formatarCentavos } from '@/servidor/dinheiro';
import { ID_DA_LINHA, ID_DO_LANCAMENTO, destinoDa } from '@/servidor/navegacao';
import { InformarCusto } from './formulario';

const NIVEIS: readonly Nivel[] = ['MP', 'PP', 'PA'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

const R = ({ v }: { v: bigint | null }) =>
  v === null ? <span className="text-stone-400">—</span> : <span className="tabular-nums">{formatarCentavos(v)}</span>;

/** Cada estado com o nome dele e, quando indefinido, o motivo — abrível. */
function Estado({
  motivo,
  rotulo,
  empresaId,
  competencia,
}: {
  motivo: Parameters<typeof mensagemDoMotivo>[0];
  rotulo: string;
  empresaId: string;
  competencia: { ano: number; mes: number };
}) {
  const destino = destinoDa(motivo.ancora, empresaId, competencia);
  return (
    <span className="text-amber-700">
      {rotulo} — {mensagemDoMotivo(motivo)}{' '}
      {destino ? (
        <Link href={destino.href} className="underline">
          abrir {destino.rotulo}
        </Link>
      ) : null}
    </span>
  );
}

function Diagnostico({ d, empresaId, competencia }: { d: DiagnosticoLido; empresaId: string; competencia: { ano: number; mes: number } }) {
  const destino = destinoDa(d.ancora, empresaId, competencia);
  const cor = d.severidade === 'erro' ? 'text-red-800' : d.severidade === 'aviso' ? 'text-amber-800' : 'text-stone-600';
  return (
    <li className={`flex flex-wrap gap-x-2 border-t border-stone-200 px-3 py-2 ${cor}`}>
      <span className="text-xs uppercase tracking-wide text-stone-400">{d.origem} · {d.severidade}</span>
      <span>{d.mensagem}</span>
      {destino ? (
        <Link href={destino.href} className="underline">
          abrir {destino.rotulo}
        </Link>
      ) : null}
    </li>
  );
}

function Lancamento({ l, empresaId }: { l: Lancamento; empresaId: string }) {
  const c = l.competencia;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <table className="rounded border border-stone-200 bg-white text-sm">
        <thead className="bg-stone-100 text-left text-xs uppercase tracking-wide text-stone-600">
          <tr><th className="px-3 py-2">Estoque</th><th className="px-3 py-2 text-right">Abertura</th><th className="px-3 py-2 text-right">Fechamento</th></tr>
        </thead>
        <tbody>
          {NIVEIS.map((n) => {
            const s = l.estoque[n];
            return (
              <tr key={n} className="border-t border-stone-200">
                <td className="px-3 py-2">{n}</td>
                {s.estado === 'lido' ? (
                  <>
                    <td className="px-3 py-2 text-right"><R v={s.abertura} /></td>
                    <td className="px-3 py-2 text-right"><R v={s.fechamento} /></td>
                  </>
                ) : (
                  <td className="px-3 py-2" colSpan={2}>
                    {s.estado === 'ausente' ? <span className="text-stone-400">ausente — decisão da empresa</span> : <Estado motivo={s.motivo} rotulo="indefinido" empresaId={empresaId} competencia={c} />}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <table className="rounded border border-stone-200 bg-white text-sm">
        <thead className="bg-stone-100 text-left text-xs uppercase tracking-wide text-stone-600">
          <tr><th className="px-3 py-2">Consumo e perda</th><th className="px-3 py-2 text-right">Consumo</th><th className="px-3 py-2 text-right">Perdas</th></tr>
        </thead>
        <tbody>
          {NIVEIS.map((n) => {
            const cs = l.consumo[n];
            return (
              <tr key={n} className="border-t border-stone-200">
                <td className="px-3 py-2">{n}</td>
                <td className="px-3 py-2 text-right">
                  {cs.estado === 'lido' ? <R v={cs.valor} /> : <Estado motivo={cs.motivo} rotulo="indefinido" empresaId={empresaId} competencia={c} />}
                </td>
                <td className="px-3 py-2 text-right">
                  {l.perdas[n] === null ? <span className="text-stone-400">não medido</span> : <R v={l.perdas[n]} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <table className="rounded border border-stone-200 bg-white text-sm md:col-span-2">
        <tbody>
          <tr className="border-t border-stone-200"><td className="px-3 py-2">CMV</td><td className="px-3 py-2 text-right"><R v={l.cmv} /></td></tr>
          <tr className="border-t border-stone-200"><td className="px-3 py-2">Receita</td><td className="px-3 py-2 text-right"><R v={l.receita} /></td></tr>
          <tr className="border-t border-stone-200"><td className="px-3 py-2">Compras de MP</td><td className="px-3 py-2 text-right"><R v={l.compras} /></td></tr>
          <tr className="border-t border-stone-200">
            <td className="px-3 py-2">Custo de materiais</td>
            <td className="px-3 py-2 text-right">
              {l.custoMateriais.origem === 'indefinido' ? (
                <Estado motivo={l.custoMateriais.motivo} rotulo="indefinido" empresaId={empresaId} competencia={c} />
              ) : (
                <>
                  <R v={l.custoMateriais.valor} />
                  <span className="ml-2 text-xs uppercase tracking-wide text-stone-500">{l.custoMateriais.origem}</span>
                  {l.custoMateriais.origem === 'conferido' ? (
                    <span className="ml-2 text-xs text-stone-500">
                      informado <R v={l.custoMateriais.informado} /> · divergência {pct.format(l.custoMateriais.divergencia)}
                    </span>
                  ) : null}
                </>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default async function Periodo({ params }: { params: Promise<{ id: string; ano: string; mes: string }> }) {
  const { id, ano: anoTexto, mes: mesTexto } = await params;
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) notFound();

  const { detalhe, papel } = await naEmpresaOu404(id, async ({ tx, papel }) => ({
    detalhe: await periodoDetalhado(tx, id, { ano, mes }),
    papel,
  }));
  if (detalhe === null) notFound();

  const competencia = { ano, mes };
  const lancamento = detalhe.periodo.estado === 'apurado' ? detalhe.periodo.lancamento : null;
  const informadoAtual =
    lancamento?.custoMateriais.origem === 'conferido' || lancamento?.custoMateriais.origem === 'informado'
      ? formatarCentavos(lancamento.custoMateriais.origem === 'conferido' ? lancamento.custoMateriais.informado : lancamento.custoMateriais.valor).replace(/^-?R\$\s?/, '')
      : null;

  return (
    <section className="flex flex-col gap-8">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium">{MESES[mes - 1]} de {ano}</h2>
        <span className={`text-xs uppercase tracking-wide ${lancamento ? 'text-green-700' : 'text-amber-700'}`}>
          {lancamento ? 'apurado' : 'importado, sem apuração'}
        </span>
      </header>

      {lancamento ? (
        <Lancamento l={lancamento} empresaId={id} />
      ) : (
        <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          A fonte está gravada, mas o mapeamento ainda não resolve este período — veja os diagnósticos abaixo e o{' '}
          <Link href={`/empresas/${id}/mapeamento`} className="underline">mapeamento</Link>.
        </p>
      )}

      <InformarCusto empresaId={id} ano={ano} mes={mes} atual={informadoAtual} podeEscrever={papel === 'editor'} />

      {detalhe.diagnosticos.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-stone-700">Diagnósticos</h3>
          <ul className="rounded border border-stone-200 bg-white text-sm">
            {detalhe.diagnosticos.map((d, i) => (
              <Diagnostico key={i} d={d} empresaId={id} competencia={competencia} />
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-medium text-stone-700">Balancete como importado</h3>
        <div className="overflow-x-auto rounded border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-100 text-left text-xs uppercase tracking-wide text-stone-600">
              <tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">Conta</th><th className="px-3 py-2">Descrição</th><th className="px-3 py-2 text-right">Saldo anterior</th><th className="px-3 py-2 text-right">Débito</th><th className="px-3 py-2 text-right">Crédito</th><th className="px-3 py-2 text-right">Saldo atual</th></tr>
            </thead>
            <tbody>
              {detalhe.linhas.map((l) => (
                <tr key={l.codigo} id={ID_DA_LINHA(l.linha)} className={`scroll-mt-4 border-t border-stone-200 target:bg-amber-50 ${l.sintetica ? 'text-stone-500' : ''}`}>
                  <td className="px-3 py-2 text-xs text-stone-400">{l.linha}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.codigo}</td>
                  <td className="px-3 py-2">{l.descricao}</td>
                  <td className="px-3 py-2 text-right"><R v={l.saldoAnterior} /></td>
                  <td className="px-3 py-2 text-right"><R v={l.debito} /></td>
                  <td className="px-3 py-2 text-right"><R v={l.credito} /></td>
                  <td className="px-3 py-2 text-right"><R v={l.saldoAtual} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detalhe.razao.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-medium text-stone-700">Razão como importado</h3>
          {detalhe.razao.map((conta) => (
            <div key={conta.codigo} className="mb-4 overflow-x-auto rounded border border-stone-200 bg-white">
              <div className="flex justify-between bg-stone-100 px-3 py-2 text-xs">
                <span><span className="font-mono">{conta.codigo}</span> · {conta.descricao}</span>
                <span className="text-stone-500">saldo anterior <R v={conta.saldoAnterior} /> · atual <R v={conta.saldoAtual} /></span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {conta.lancamentos.map((r) => (
                    <tr key={r.linha} id={ID_DO_LANCAMENTO(conta.codigo, r.linha)} className="scroll-mt-4 border-t border-stone-200 target:bg-amber-50">
                      <td className="px-3 py-2 text-xs text-stone-400">{r.linha}</td>
                      <td className="px-3 py-2 text-xs">{r.data ?? '—'}</td>
                      <td className="px-3 py-2">{r.historico}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.contrapartida ?? <span className="text-amber-700">sem contrapartida</span>}</td>
                      <td className="px-3 py-2 text-right"><R v={r.debito} /></td>
                      <td className="px-3 py-2 text-right"><R v={r.credito} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
