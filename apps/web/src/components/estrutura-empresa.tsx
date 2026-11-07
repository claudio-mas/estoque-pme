'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { LayoutGridIcon, SlidersHorizontalIcon, UploadIcon, UsersIcon } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Badge } from '@/components/ui/badge';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { CHAVE_DO_TEMA } from '@/lib/tema';

/**
 * O shell da empresa sobre o bloco app-shell do informas-ui: barra lateral (gaveta
 * abaixo de 768 px, com foco preso e Escape), topo com a empresa e o papel, link para
 * pular ao conteúdo e seletor de tema.
 */
export function EstruturaDaEmpresa({
  empresaId, nome, papel, children,
}: {
  empresaId: string; nome: string; papel: string; children: ReactNode;
}) {
  const caminho = usePathname();
  const base = `/empresas/${empresaId}`;
  const itens = [
    { href: base, rotulo: 'Períodos', Icone: LayoutGridIcon, ativo: caminho === base || caminho.startsWith(`${base}/periodos/`) },
    { href: `${base}/importar`, rotulo: 'Importar', Icone: UploadIcon, ativo: caminho === `${base}/importar` },
    { href: `${base}/mapeamento`, rotulo: 'Mapeamento', Icone: SlidersHorizontalIcon, ativo: caminho === `${base}/mapeamento` },
  ];

  return (
    <AppShell
      themeStorageKey={CHAVE_DO_TEMA}
      brand={
        <Link href="/" aria-label="Estoque PME — suas empresas" className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <LayoutGridIcon className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <strong className="block text-sm font-semibold">Estoque PME</strong>
            <small className="block truncate text-[11px] text-muted-foreground" title={nome}>{nome}</small>
          </span>
        </Link>
      }
      navigation={
        <SidebarGroup>
          <SidebarGroupLabel>Dados e apuração</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {itens.map(({ href, rotulo, Icone, ativo }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={ativo}>
                    <Link href={href} aria-current={ativo ? 'page' : undefined}>
                      <Icone aria-hidden="true" />
                      <span>{rotulo}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      }
      sidebarFooter={
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/">
                <UsersIcon aria-hidden="true" />
                <span>Suas empresas</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      }
      header={
        <>
          <span className="truncate text-sm font-medium" title={nome}>{nome}</span>
          <Badge variant="outline" className="ml-auto">{papel === 'editor' ? 'Editor' : 'Somente leitura'}</Badge>
        </>
      }
    >
      <div className="mx-auto max-w-[1800px]">{children}</div>
    </AppShell>
  );
}
