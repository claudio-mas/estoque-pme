import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Estoque PME',
  description: 'Planejamento financeiro e orçamentário de estoque para a indústria de alimentos.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">{children}</body>
    </html>
  );
}
