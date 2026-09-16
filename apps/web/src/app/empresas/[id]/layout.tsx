import Link from 'next/link';
import { naEmpresaOu404 } from '@/servidor/acesso';
import { schema } from '@estoque-pme/dados';
import { eq } from 'drizzle-orm';

/**
 * O layout confere o vínculo e mostra a navegação — e **só isso**. As actions
 * não passam por aqui; cada uma reconfere em `naEmpresa`. Este layout existe
 * para a página não abrir, não para a escrita ser segura.
 */
export default async function LayoutDaEmpresa({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { nome, papel } = await naEmpresaOu404(id, async ({ tx, papel }) => {
    const [linha] = await tx
      .select({ nome: schema.empresa.nome })
      .from(schema.empresa)
      .where(eq(schema.empresa.id, id))
      .limit(1);
    return { nome: linha?.nome ?? '—', papel };
  });

  const base = `/empresas/${id}`;
  const abas = [
    [base, 'Períodos'],
    [`${base}/importar`, 'Importar'],
    [`${base}/mapeamento`, 'Mapeamento'],
  ] as const;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-200 pb-4">
        <div>
          <Link href="/" className="text-xs text-stone-500 hover:underline">
            ← Suas empresas
          </Link>
          <h1 className="text-xl font-semibold">{nome}</h1>
        </div>
        <nav className="flex gap-4 text-sm">
          {abas.map(([href, rotulo]) => (
            <Link key={href} href={href} className="hover:underline">
              {rotulo}
            </Link>
          ))}
          <span className="text-xs uppercase tracking-wide text-stone-400">{papel}</span>
        </nav>
      </header>
      {children}
    </div>
  );
}
