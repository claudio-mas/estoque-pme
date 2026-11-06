import type { HTMLAttributes, ReactNode } from 'react';
import { Icone } from './icone';

const TONS = {
  // Classes por extenso: o Tailwind só gera o que encontra escrito no código.
  info: { borda: 'border-l-info [&_strong]:text-info-subtle-foreground', destaque: 'text-info-subtle-foreground', icone: 'info' },
  sucesso: { borda: 'border-l-success [&_strong]:text-success-subtle-foreground', destaque: 'text-success-subtle-foreground', icone: 'confere' },
  aviso: { borda: 'border-l-warning [&_strong]:text-warning-subtle-foreground', destaque: 'text-warning-subtle-foreground', icone: 'alerta' },
  erro: { borda: 'border-l-destructive [&_strong]:text-destructive-subtle-foreground', destaque: 'text-destructive-subtle-foreground', icone: 'alerta' },
} as const;

/** Aviso em bloco. `role="alert"`/`"status"` ficam com quem chama, que sabe se a mensagem é urgente. */
export function Aviso({
  tom = 'info', rotulo, children, className = '', ...props
}: HTMLAttributes<HTMLElement> & { tom?: keyof typeof TONS; rotulo: string; children: ReactNode }) {
  const t = TONS[tom];
  return (
    <section aria-label={rotulo} {...props}
      className={`flex items-start gap-3 rounded-lg border border-l-[3px] border-border bg-card px-4 py-3.5 text-sm text-card-foreground ${t.borda} ` +
        `[&_strong]:font-semibold [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-[18px] [&_p]:mt-1.5 [&_p]:text-xs ${className}`}>
      <Icone nome={t.icone} className={`mt-0.5 size-4 ${t.destaque}`} />
      <div className="min-w-0">{children}</div>
    </section>
  );
}
