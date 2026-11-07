'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Nivel } from '@estoque-pme/motor-calculo';
import { CheckIcon, InfoIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { salvar } from './acoes';
import type { EstadoDoMapeamento } from './acoes';
import type { ContaNaTela, DecisaoDoFormulario } from './decisoes';
import { ID_DA_CONTA } from '@/servidor/navegacao';

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

function rascunhoInicial(contas: readonly ContaNaTela[], ausentes: readonly Nivel[]) {
  return {
    decisoes: Object.fromEntries(contas.map((c) => [c.codigo, c.atual])) as Record<string, DecisaoDoFormulario>,
    ausentes: [...ausentes],
    motivo: '',
  };
}

export function Formulario({
  empresaId, contas, ausentes, podeEscrever, versaoAtual,
}: {
  empresaId: string;
  contas: readonly ContaNaTela[];
  ausentes: readonly Nivel[];
  podeEscrever: boolean;
  versaoAtual: number | null;
}) {
  const [estado, agir, pendente] = useActionState(salvar, INICIAL);
  const [rascunho, setRascunho] = useState(() => rascunhoInicial(contas, ausentes));
  const [alterado, setAlterado] = useState(false);
  const [versaoSincronizada, setVersaoSincronizada] = useState<number | null>(null);
  const router = useRouter();
  const atualizando = estado.versao !== null && versaoSincronizada !== estado.versao;
  const bloqueado = pendente || atualizando || !podeEscrever;
  const pendentes = contas.filter((c) => !c.coberta && (rascunho.decisoes[c.codigo] ?? c.atual) === 'pendente').length;

  useEffect(() => {
    if (estado.versao !== null) router.refresh();
  }, [estado.versao, router]);

  // Somente o sucesso deste formulário aceita uma nova base. Erros e refreshes
  // comuns preservam as escolhas. Esperar as props evita sobrescrever o salvo
  // com sugestões antigas e bloqueia edição durante essa pequena atualização.
  useEffect(() => {
    if (estado.versao === null || estado.versao === versaoSincronizada ||
        (versaoAtual ?? 0) < estado.versao) return;
    setRascunho(rascunhoInicial(contas, ausentes));
    setAlterado(false);
    setVersaoSincronizada(estado.versao);
  }, [estado.versao, versaoAtual, versaoSincronizada, contas, ausentes]);

  return (
    <form action={agir} className="flex min-w-0 flex-col gap-5" aria-busy={pendente || atualizando}
      // React solicita reset nativo após a action. Em select, ele pode restaurar
      // a primeira opção mesmo com value controlado. A base é atualizada acima.
      onReset={(evento) => evento.preventDefault()}>
      <input type="hidden" name="empresaId" value={empresaId} />
      {estado.erros.length > 0 ? (
        <Alert variant="destructive" aria-label="Não foi possível salvar">
          <AlertTitle>Revise o mapeamento</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-[18px]">{estado.erros.map((e) => <li key={e}>{e}</li>)}</ul>
            <p className="text-xs">Suas escolhas foram mantidas. Corrija o conflito e tente novamente.</p>
          </AlertDescription>
        </Alert>
      ) : null}
      {estado.versao !== null && !alterado ? (
        <Alert variant="success" aria-label="Mapeamento salvo">
          <CheckIcon />
          <AlertTitle>Versão {estado.versao} salva.</AlertTitle>
          <AlertDescription>{estado.periodosReapurados} período(s) reapurado(s).</AlertDescription>
        </Alert>
      ) : null}
      {estado.avisos.length > 0 ? (
        <Alert variant="warning" aria-label="Avisos do mapeamento">
          <AlertTitle>Avisos do mapeamento</AlertTitle>
          <AlertDescription><ul className="list-disc pl-[18px]">{estado.avisos.map((a) => <li key={a}>{a}</li>)}</ul></AlertDescription>
        </Alert>
      ) : null}
      {!podeEscrever ? (
        <Alert variant="info" role={undefined} aria-label="Acesso de leitura">
          <InfoIcon />
          <AlertDescription>Seu papel nesta empresa é de leitura. As classificações podem ser consultadas.</AlertDescription>
        </Alert>
      ) : null}

      <fieldset disabled={bloqueado} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
        <legend className="sr-only">Editar mapeamento de contas</legend>
        <fieldset className="rounded-xl border border-border bg-card px-5 pb-4 pt-3 max-md:px-3.5">
          <legend className="px-1.5 text-[13px] font-semibold">Níveis que a empresa não movimenta</legend>
          <div className="mb-2.5 flex flex-wrap gap-6 max-md:gap-4">
            {NIVEIS.map((n) => (
              <label key={n} className="inline-flex min-h-8 items-center gap-2.5">
                <input type="checkbox" className="size-4 accent-primary disabled:cursor-not-allowed" name="ausente" value={n} checked={rascunho.ausentes.includes(n)}
                  onChange={(e) => {
                    const marcado = e.target.checked;
                    setRascunho((r) => ({ ...r, ausentes: marcado ? [...r.ausentes, n] : r.ausentes.filter((v) => v !== n) }));
                    setAlterado(true);
                  }} />
                {n} ausente
              </label>
            ))}
          </div>
          <p className="text-xs leading-normal text-muted-foreground">Declarar ausente não basta se houver conta pendente com a cara do nível — ela precisa ser ignorada.</p>
        </fieldset>

        <div className="mt-1 flex items-center justify-between gap-4">
          <div><h3 className="mb-1 text-base font-semibold">Classificação das contas</h3><p className="text-xs text-muted-foreground">{contas.length} contas no histórico da empresa</p></div>
          <Badge variant="outline">{pendentes} pendente(s)</Badge>
        </div>
        <p className="hidden text-xs text-muted-foreground max-md:block">Deslize a tabela para escolher o papel de cada conta →</p>
        <div className="overflow-x-auto rounded-xl border border-border bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" tabIndex={0} role="region" aria-label="Contas contábeis, tabela com rolagem horizontal">
          <table className="w-full min-w-[780px] border-collapse text-left text-[13px] [&_td]:border-b [&_td]:border-border [&_td]:px-4 [&_td]:py-3.5 [&_td]:align-middle [&_th]:border-b [&_th]:border-border [&_th]:px-4 [&_th]:py-3.5 [&_th]:align-middle [&_tbody_tr:last-child>*]:border-b-0">
            <caption className="sr-only">Papéis das contas e justificativas das propostas de classificação</caption>
            <thead className="bg-muted text-muted-foreground [&_th]:h-11 [&_th]:font-medium"><tr>
              <th scope="col">Conta</th><th scope="col">Descrição</th><th scope="col">Papel no modelo</th><th scope="col">Por quê</th>
            </tr></thead>
            <tbody>{contas.map((c) => (
              <tr key={c.codigo} id={ID_DA_CONTA(c.codigo)} className={`scroll-mt-[84px] hover:bg-muted/50 target:bg-warning-subtle target:outline-2 target:-outline-offset-2 target:outline-ring ${c.sintetica ? 'text-muted-foreground' : ''}`}>
                <th scope="row" className="w-[138px] whitespace-nowrap font-mono text-xs font-normal" style={{ paddingLeft: `${16 + Math.min(c.grau - 1, 4) * 8}px` }}>{c.codigo}</th>
                <td><span className="block min-w-40 text-xs font-medium">{c.descricao}</span>{c.sintetica ? <small className="text-xs leading-normal text-muted-foreground">Conta sintética</small> : null}
                  {c.coberta ? null : <input type="hidden" name={`n:${c.codigo}`} value={c.descricao} />}
                </td>
                <td>{c.coberta ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title="Coberta por decisão acima ou abaixo dela; não se classifica."><CheckIcon className="size-3.5" aria-hidden="true" /> coberta</span>
                ) : (
                  <NativeSelect name={`d:${c.codigo}`} className="w-[190px]" aria-label={`Papel da conta ${c.codigo}`}
                    value={rascunho.decisoes[c.codigo] ?? c.atual}
                    onChange={(e) => {
                      const valor = e.target.value as DecisaoDoFormulario;
                      setRascunho((r) => ({ ...r, decisoes: { ...r.decisoes, [c.codigo]: valor } }));
                      setAlterado(true);
                    }}>
                    {(Object.keys(ROTULOS) as DecisaoDoFormulario[]).map((d) => <NativeSelectOption key={d} value={d}>{ROTULOS[d]}</NativeSelectOption>)}
                  </NativeSelect>
                )}</td>
                <td className="min-w-[200px] max-w-[340px] text-xs leading-normal text-muted-foreground">
                  {c.sugestao ? <><span className="mb-0.5 block text-[11px] font-semibold text-info-subtle-foreground">Proposta</span><span>{c.sugestao.motivo}</span></> : null}
                  {c.incoerente ? <span className="text-warning-subtle-foreground">{c.incoerente}</span> : null}
                  {!c.sugestao && !c.incoerente && !c.coberta ? <span className="text-xs leading-normal text-muted-foreground">{c.atual === 'pendente' ? 'Aguardando sua decisão' : 'Decisão salva pela empresa'}</span> : null}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="flex items-end gap-5 rounded-xl border border-border bg-card p-5 max-md:flex-col max-md:items-stretch max-md:gap-4 max-md:p-4">
          <label className="flex min-w-0 flex-1 flex-col gap-2 text-[13px] font-medium">Motivo desta versão (opcional)
            <Input name="motivo" maxLength={200} className="font-normal" value={rascunho.motivo}
              placeholder="Ex.: revisão do fechamento de agosto"
              onChange={(e) => {
                const motivo = e.target.value;
                setRascunho((r) => ({ ...r, motivo }));
                setAlterado(true);
              }} />
          </label>
          <Button type="submit" disabled={bloqueado} className="max-md:min-h-[42px]">
            <CheckIcon aria-hidden="true" />
            {pendente ? 'Salvando e reapurando…' : atualizando ? 'Atualizando…' : 'Salvar mapeamento'}
          </Button>
        </div>
      </fieldset>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 max-md:items-start"><InfoIcon className="size-3.5" aria-hidden="true" /> Salvar grava uma versão e reapura o histórico inteiro.</span>
        <span className={alterado ? 'text-warning-subtle-foreground' : 'text-muted-foreground'}>{alterado ? 'Alterações no rascunho' : 'Mapeamento por empresa'}</span>
      </div>
    </form>
  );
}
