'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icone, type NomeDoIcone } from './ui/icone';
import { SeletorDeTema } from './ui/seletor-de-tema';

const ROTULO = 'block text-[11px] uppercase tracking-[0.08em] text-muted-foreground';
const SELO = 'inline-flex items-center whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground';
const BOTAO_DE_ICONE = 'inline-flex size-9 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

function ItemDeNavegacao({ href, icone, ativo, aoNavegar, children }: { href: string; icone: NomeDoIcone; ativo: boolean; aoNavegar: () => void; children: ReactNode }) {
  return (
    <Link href={href} aria-current={ativo ? 'page' : undefined} onClick={aoNavegar}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-semibold aria-[current=page]:text-sidebar-accent-foreground">
      <Icone nome={icone} className="size-4" />
      <span>{children}</span>
    </Link>
  );
}

/**
 * O shell da empresa: topo, navegação lateral e, abaixo de 768 px, a navegação
 * numa gaveta modal (foco preso dentro, Escape fecha, o foco volta ao botão).
 */
export function EstruturaDaEmpresa({
  empresaId, nome, papel, children,
}: {
  empresaId: string; nome: string; papel: string; children: ReactNode;
}) {
  const caminho = usePathname();
  const base = `/empresas/${empresaId}`;
  const [aberta, setAberta] = useState(false);
  const gatilho = useRef<HTMLButtonElement>(null);
  const lateral = useRef<HTMLElement>(null);

  const fechar = () => { setAberta(false); gatilho.current?.focus(); };

  useEffect(() => {
    if (aberta) lateral.current?.querySelector<HTMLElement>('button, a[href]')?.focus();
  }, [aberta]);

  useEffect(() => {
    const largo = matchMedia('(min-width: 48rem)');
    const soltar = () => { if (largo.matches) setAberta(false); };
    largo.addEventListener('change', soltar);
    return () => largo.removeEventListener('change', soltar);
  }, []);

  function teclado(evento: KeyboardEvent<HTMLElement>) {
    if (!aberta) return;
    if (evento.key === 'Escape') { evento.preventDefault(); fechar(); return; }
    if (evento.key !== 'Tab') return;
    const focaveis = [...(lateral.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input') ?? [])];
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo?.focus(); }
    if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro?.focus(); }
  }

  const aoNavegar = () => setAberta(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow-md">
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2.5 border-b border-border bg-background px-4 md:gap-6 md:px-6">
        <button ref={gatilho} type="button" className={`${BOTAO_DE_ICONE} md:hidden`} aria-label="Abrir navegação" aria-expanded={aberta}
          onClick={() => setAberta(true)}>
          <Icone nome="menu" />
        </button>
        <Link href="/" aria-label="Estoque PME — suas empresas" className="mr-auto flex shrink-0 items-center gap-2.5 md:mr-0">
          <span className="grid size-[34px] place-items-center rounded-lg bg-primary text-primary-foreground"><Icone nome="grade" /></span>
          <span>
            <strong className="block text-base font-semibold">Estoque PME</strong>
            <small className="block text-[11px] text-muted-foreground max-md:hidden">Planejamento de estoque</small>
          </span>
        </Link>
        <span className="ml-auto truncate text-sm text-muted-foreground max-md:hidden" title={nome}>{nome}</span>
        <span className={`${SELO} max-md:hidden`}>{papel === 'editor' ? 'Editor' : 'Somente leitura'}</span>
      </header>

      <div className="flex">
        {aberta ? <button type="button" className="fixed inset-0 z-40 bg-black/40 md:hidden" aria-label="Fechar menu lateral" onClick={fechar} /> : null}
        <aside ref={lateral} role={aberta ? 'dialog' : undefined} aria-modal={aberta || undefined} aria-label="Navegação principal" onKeyDown={teclado}
          className={`${aberta ? 'fixed inset-y-0 left-0 z-50 flex shadow-xl' : 'hidden'} w-[280px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground md:sticky md:top-16 md:flex md:h-[calc(100vh-4rem)] md:shadow-none`}>
          <div className="flex justify-end md:hidden">
            <button type="button" className={BOTAO_DE_ICONE} aria-label="Fechar navegação" onClick={fechar}><Icone nome="fechar" /></button>
          </div>
          <div className="px-3 pt-3">
            <span className={ROTULO}>Empresa atual</span>
            <h1 className="mt-2 text-base font-semibold [overflow-wrap:anywhere]">{nome}</h1>
          </div>
          <div>
            <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">Dados e apuração</p>
            <nav aria-label="Área da empresa" className="flex flex-col gap-0.5">
              <ItemDeNavegacao href={base} icone="grade" aoNavegar={aoNavegar} ativo={caminho === base || caminho.startsWith(`${base}/periodos/`)}>Períodos</ItemDeNavegacao>
              <ItemDeNavegacao href={`${base}/importar`} icone="enviar" aoNavegar={aoNavegar} ativo={caminho === `${base}/importar`}>Importar</ItemDeNavegacao>
              <ItemDeNavegacao href={`${base}/mapeamento`} icone="ajustes" aoNavegar={aoNavegar} ativo={caminho === `${base}/mapeamento`}>Mapeamento</ItemDeNavegacao>
            </nav>
          </div>
          <div className="mt-auto grid gap-6 px-3 pb-3">
            <Link href="/" onClick={aoNavegar} className="flex items-center gap-2 text-[13px] hover:underline"><Icone nome="pessoas" className="size-4" /> Suas empresas</Link>
            <SeletorDeTema />
          </div>
        </aside>
        <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 focus:outline-none md:px-8 md:py-8">
          <div className="mx-auto max-w-[1800px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
