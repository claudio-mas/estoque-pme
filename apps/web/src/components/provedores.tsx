'use client';

import { ThemeProvider } from 'cloudscape-ui';
import type { ReactNode } from 'react';

export function Provedores({ children }: { children: ReactNode }) {
  return <ThemeProvider storageKey="estoque-pme.aparencia">{children}</ThemeProvider>;
}
