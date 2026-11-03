import type { Metadata } from 'next';
import './globals.css';
import { Provedores } from '@/components/provedores';

export const metadata: Metadata = {
  title: 'Estoque PME',
  description: 'Planejamento financeiro e orçamentário de estoque para a indústria de alimentos.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased"><Provedores>{children}</Provedores></body>
    </html>
  );
}
