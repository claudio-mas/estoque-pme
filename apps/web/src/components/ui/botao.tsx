import type { ButtonHTMLAttributes } from 'react';
import { Icone, type NomeDoIcone } from './icone';

const BASE =
  'inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50';
const VARIANTES = {
  primario: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secundario: 'border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
} as const;

/** Sem hooks: funciona em Server Components e em formulários de Server Action. */
export function Botao({
  variante = 'primario', icone, className = '', type = 'button', children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: keyof typeof VARIANTES; icone?: NomeDoIcone }) {
  return (
    <button type={type} className={`${BASE} ${VARIANTES[variante]} ${className}`} {...props}>
      {icone ? <Icone nome={icone} className="size-4" /> : null}
      {children}
    </button>
  );
}
