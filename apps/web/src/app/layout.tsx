import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { SCRIPT_DO_TEMA } from '@/components/ui/tema';

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
        <Script id="tema" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA }} />
      </body>
    </html>
  );
}
