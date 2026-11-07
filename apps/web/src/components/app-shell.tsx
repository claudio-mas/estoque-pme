"use client"

import * as React from "react"

import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { ThemeSwitcher } from "@/components/ui/theme-switcher"

type AppShellProps = {
  /** Topo da barra lateral: marca, nome do produto, empresa atual. */
  brand: React.ReactNode
  /**
   * Navegação: SidebarGroup/SidebarMenu. Use `SidebarMenuButton asChild isActive`
   * com o Link do seu framework, para o item ativo ganhar `data-active` e `aria-current`.
   */
  navigation: React.ReactNode
  /** Conteúdo do topo da área principal (título, ações, usuário). */
  header?: React.ReactNode
  /** Rodapé da barra lateral, acima do seletor de tema. */
  sidebarFooter?: React.ReactNode
  /** Chave da preferência de tema no localStorage (a mesma do themeScript). */
  themeStorageKey?: string
  children: React.ReactNode
}

/**
 * No celular a barra lateral é uma gaveta. Em apps com layout persistente (Next.js), tocar num
 * link não a desmonta: ela ficaria aberta sobre a nova página. Fecha ao seguir qualquer link.
 */
function CloseOnNavigate({ children }: { children: React.ReactNode }) {
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <div
      className="contents"
      onClick={(event) => {
        if (isMobile && (event.target as HTMLElement).closest("a[href]")) setOpenMobile(false)
      }}
    >
      {children}
    </div>
  )
}

/**
 * Estrutura de aplicação: barra lateral recolhível (gaveta no celular), topo com o
 * botão de alternar, link para pular ao conteúdo e seletor Claro/Escuro/Sistema.
 * É um bloco: o código fica no projeto para ser ajustado.
 */
export function AppShell({
  brand,
  navigation,
  header,
  sidebarFooter,
  themeStorageKey,
  children,
}: AppShellProps) {
  return (
    <SidebarProvider>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow-md focus:ring-2 focus:ring-ring"
      >
        Pular para o conteúdo
      </a>
      <Sidebar>
        <CloseOnNavigate>
          <SidebarHeader>{brand}</SidebarHeader>
          <SidebarContent>{navigation}</SidebarContent>
          <SidebarFooter>
            {sidebarFooter}
            <ThemeSwitcher storageKey={themeStorageKey} className="px-2 pb-2" />
          </SidebarFooter>
        </CloseOnNavigate>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <div className="flex min-w-0 flex-1 items-center gap-2">{header}</div>
        </header>
        <div id="conteudo" tabIndex={-1} className="flex-1 p-4 outline-none md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
