import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { themeScript } from '@/lib/theme-mode';
import { CHAVE_DO_TEMA } from '@/lib/tema';

export const metadata: Metadata = {
  title: 'Estoque PME',
  description: 'Planejamento financeiro e orçamentário de estoque para a indústria de alimentos.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    // O script do tema muda a classe do <html> antes da hidratação; daí o suppressHydrationWarning.
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Script id="tema" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript(CHAVE_DO_TEMA) }} />
      </body>
    </html>
  );
}
