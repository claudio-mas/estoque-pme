'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Nivel } from '@estoque-pme/motor-calculo';
import { Button, Icon, Notice } from '@/components/cloudscape';
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
    <form action={agir} className="pme-mapeamento" aria-busy={pendente || atualizando}
      // React solicita reset nativo após a action. Em select, ele pode restaurar
      // a primeira opção mesmo com value controlado. A base é atualizada acima.
      onReset={(evento) => evento.preventDefault()}>
      <input type="hidden" name="empresaId" value={empresaId} />
      {estado.erros.length > 0 ? (
        <div role="alert" className="pme-feedback pme-feedback--erro">
          <Notice label="Não foi possível salvar">
            <strong>Revise o mapeamento</strong>
            <ul>{estado.erros.map((e) => <li key={e}>{e}</li>)}</ul>
            <p>Suas escolhas foram mantidas. Corrija o conflito e tente novamente.</p>
          </Notice>
        </div>
      ) : null}
      {estado.versao !== null && !alterado ? (
        <div role="status" className="pme-feedback pme-feedback--sucesso">
          <Notice label="Mapeamento salvo">
            <strong>Versão {estado.versao} salva.</strong> {estado.periodosReapurados} período(s) reapurado(s).
          </Notice>
        </div>
      ) : null}
      {estado.avisos.length > 0 ? (
        <div className="pme-feedback pme-feedback--aviso">
          <Notice label="Avisos do mapeamento"><ul>{estado.avisos.map((a) => <li key={a}>{a}</li>)}</ul></Notice>
        </div>
      ) : null}
      {!podeEscrever ? (
        <Notice label="Acesso de leitura">Seu papel nesta empresa é de leitura. As classificações podem ser consultadas.</Notice>
      ) : null}

      <fieldset disabled={bloqueado} className="pme-controles">
        <legend className="cs-sr-only">Editar mapeamento de contas</legend>
        <fieldset className="pme-niveis">
          <legend>Níveis que a empresa não movimenta</legend>
          <div className="pme-niveis-opcoes">
            {NIVEIS.map((n) => (
              <label key={n} className="pme-checkbox">
                <input type="checkbox" name="ausente" value={n} checked={rascunho.ausentes.includes(n)}
                  onChange={(e) => {
                    const marcado = e.target.checked;
                    setRascunho((r) => ({ ...r, ausentes: marcado ? [...r.ausentes, n] : r.ausentes.filter((v) => v !== n) }));
                    setAlterado(true);
                  }} />
                {n} ausente
              </label>
            ))}
          </div>
          <p className="pme-ajuda">Declarar ausente não basta se houver conta pendente com a cara do nível — ela precisa ser ignorada.</p>
        </fieldset>

        <div className="pme-table-heading">
          <div><h3>Classificação das contas</h3><p>{contas.length} contas no histórico da empresa</p></div>
          <span className="pme-badge">{pendentes} pendente(s)</span>
        </div>
        <p className="pme-mobile-help">Deslize a tabela para escolher o papel de cada conta →</p>
        <div className="pme-table-wrap" tabIndex={0} role="region" aria-label="Contas contábeis, tabela com rolagem horizontal">
          <table className="pme-account-table">
            <caption className="cs-sr-only">Papéis das contas e justificativas das propostas de classificação</caption>
            <thead><tr>
              <th scope="col">Conta</th><th scope="col">Descrição</th><th scope="col">Papel no modelo</th><th scope="col">Por quê</th>
            </tr></thead>
            <tbody>{contas.map((c) => (
              <tr key={c.codigo} id={ID_DA_CONTA(c.codigo)} className={c.sintetica ? 'pme-sintetica' : undefined}>
                <th scope="row" className="pme-account-code" style={{ paddingLeft: `${16 + Math.min(c.grau - 1, 4) * 8}px` }}>{c.codigo}</th>
                <td><span className="pme-account-name">{c.descricao}</span>{c.sintetica ? <small className="pme-ajuda">Conta sintética</small> : null}
                  {c.coberta ? null : <input type="hidden" name={`n:${c.codigo}`} value={c.descricao} />}
                </td>
                <td>{c.coberta ? (
                  <span className="pme-covered" title="Coberta por decisão acima ou abaixo dela; não se classifica."><Icon name="check" /> coberta</span>
                ) : (
                  <select name={`d:${c.codigo}`} className="pme-select" aria-label={`Papel da conta ${c.codigo}`}
                    value={rascunho.decisoes[c.codigo] ?? c.atual}
                    onChange={(e) => {
                      const valor = e.target.value as DecisaoDoFormulario;
                      setRascunho((r) => ({ ...r, decisoes: { ...r.decisoes, [c.codigo]: valor } }));
                      setAlterado(true);
                    }}>
                    {(Object.keys(ROTULOS) as DecisaoDoFormulario[]).map((d) => <option key={d} value={d}>{ROTULOS[d]}</option>)}
                  </select>
                )}</td>
                <td className="pme-account-reason">
                  {c.sugestao ? <><span className="pme-proposta">Proposta</span><span>{c.sugestao.motivo}</span></> : null}
                  {c.incoerente ? <span className="pme-text-warning">{c.incoerente}</span> : null}
                  {!c.sugestao && !c.incoerente && !c.coberta ? <span className="pme-ajuda">{c.atual === 'pendente' ? 'Aguardando sua decisão' : 'Decisão salva pela empresa'}</span> : null}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="pme-save">
          <label className="pme-field">Motivo desta versão (opcional)
            <input name="motivo" maxLength={200} className="pme-input" value={rascunho.motivo}
              placeholder="Ex.: revisão do fechamento de agosto"
              onChange={(e) => {
                const motivo = e.target.value;
                setRascunho((r) => ({ ...r, motivo }));
                setAlterado(true);
              }} />
          </label>
          <Button type="submit" variant="primary" icon="check" disabled={bloqueado}>
            {pendente ? 'Salvando e reapurando…' : atualizando ? 'Atualizando…' : 'Salvar mapeamento'}
          </Button>
        </div>
      </fieldset>
      <div className="pme-save-note">
        <span><Icon name="info" /> Salvar grava uma versão e reapura o histórico inteiro.</span>
        <span className={alterado ? 'pme-unsaved' : 'pme-ajuda'}>{alterado ? 'Alterações no rascunho' : 'Mapeamento por empresa'}</span>
      </div>
    </form>
  );
}
