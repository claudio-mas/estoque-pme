import type { ReactNode } from 'react';

export function Vazio({ titulo, descricao, children }: { titulo: string; descricao?: string; children?: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <h3 className="text-base font-semibold">{titulo}</h3>
      {descricao ? <p className="max-w-prose text-sm text-muted-foreground">{descricao}</p> : null}
      {children}
    </div>
  );
}
