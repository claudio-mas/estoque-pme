'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { informar } from './acoes';
import type { EstadoDoInforme } from './acoes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const INICIAL: EstadoDoInforme = { versao: null, erro: null };

/**
 * O valor informado do custo de materiais (ADR-0010).
 *
 * Existe porque o razão é opcional (ADR-0006): sem ele, MP inteiro depende
 * deste campo — e o aviso permanente que o acompanha na apuração é o preço de
 * aceitar o caminho manual.
 */
export function InformarCusto({
  empresaId,
  ano,
  mes,
  atual,
  podeEscrever,
}: {
  empresaId: string;
  ano: number;
  mes: number;
  atual: string | null;
  podeEscrever: boolean;
}) {
  const [estado, agir, pendente] = useActionState(informar, INICIAL);
  const router = useRouter();

  useEffect(() => {
    if (estado.versao !== null) router.refresh();
  }, [estado.versao, router]);

  return (
    <form action={agir} className="flex flex-wrap items-end gap-3 rounded border border-border bg-card p-3 text-sm">
      <input type="hidden" name="empresaId" value={empresaId} />
      <input type="hidden" name="ano" value={ano} />
      <input type="hidden" name="mes" value={mes} />
      <label className="flex flex-col gap-1">
        Custo de materiais informado (R$)
        <Input
          name="valor"
          inputMode="decimal"
          placeholder="18.500,00"
          defaultValue={atual ?? ''}
          disabled={!podeEscrever}
          className="w-44 text-right tabular-nums"
        />
      </label>
      <Button type="submit" disabled={pendente || !podeEscrever}>
        {pendente ? 'Gravando…' : 'Informar'}
      </Button>
      <span className="text-xs text-muted-foreground">
        Só quando o razão não existe. Com os dois, prevalece o derivado e a divergência fica à vista (RF-29).
      </span>
      {estado.erro ? <p className="w-full text-destructive-subtle-foreground">{estado.erro}</p> : null}
      {estado.versao !== null ? (
        <p className="w-full text-success-subtle-foreground">Versão {estado.versao} gravada; período reapurado.</p>
      ) : null}
    </form>
  );
}
