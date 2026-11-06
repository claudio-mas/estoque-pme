'use client';

import { AppShell, Icon, SidebarLink, ThemeSwitcher } from 'cloudscape-ui';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function EstruturaDaEmpresa({
  empresaId, nome, papel, children,
}: {
  empresaId: string; nome: string; papel: string; children: ReactNode;
}) {
  const caminho = usePathname();
  const base = `/empresas/${empresaId}`;
  const mapeamento = caminho === `${base}/mapeamento`;
  return (
    <div className="pme-shell">
      <AppShell
        header={<>
          <a className="pme-brand" href="/" aria-label="Estoque PME — suas empresas">
            <span className="pme-brand-icon"><Icon name="grid" /></span>
            <span><strong>Estoque PME</strong><small>Planejamento de estoque</small></span>
          </a>
          <span className="pme-header-company" title={nome}>{nome}</span>
          <span className="pme-badge pme-role">{papel === 'editor' ? 'Editor' : 'Somente leitura'}</span>
        </>}
        sidebar={<>
          <div className="pme-company"><span className="pme-eyebrow">Empresa atual</span><h1>{nome}</h1></div>
          <p className="cs-sidebar-group">Dados e apuração</p>
          <nav aria-label="Área da empresa">
            <SidebarLink href={base} icon="grid" active={caminho === base || caminho?.startsWith(`${base}/periodos/`)}>Períodos</SidebarLink>
            <SidebarLink href={`${base}/importar`} icon="upload" active={caminho === `${base}/importar`}>Importar</SidebarLink>
            <SidebarLink href={`${base}/mapeamento`} icon="settings" active={mapeamento}>Mapeamento</SidebarLink>
          </nav>
          <div className="cs-sidebar-bottom pme-sidebar-bottom">
            <a href="/" className="pme-company-switch"><Icon name="people" /> Suas empresas</a>
            <ThemeSwitcher />
          </div>
        </>}
      >
        {mapeamento ? children : <div className="pme-legado cs-ui" data-cs-theme="light">{children}</div>}
      </AppShell>
    </div>
  );
}
