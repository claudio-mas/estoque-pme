import type { SVGProps } from 'react';

const TRACOS = {
  grade: 'M4 4h5v5H4ZM15 4h5v5h-5ZM4 15h5v5H4ZM15 15h5v5h-5Z',
  enviar: 'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
  ajustes: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  pessoas: 'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M18 4a4 4 0 0 1 0 8M22 21v-3a4 4 0 0 0-3-3.87',
  confere: 'm5 12 4 4L19 6',
  info: 'M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  alerta: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0',
  menu: 'M4 6h16M4 12h16M4 18h16',
  fechar: 'm6 6 12 12M6 18 18 6',
} as const;

export type NomeDoIcone = keyof typeof TRACOS;

/** Ícones de traço, decorativos: quem dá nome ao controle é o rótulo dele. */
export function Icone({ nome, className = 'size-5', ...props }: SVGProps<SVGSVGElement> & { nome: NomeDoIcone }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" className={`shrink-0 ${className}`} {...props}>
      <path d={TRACOS[nome]} />
    </svg>
  );
}
