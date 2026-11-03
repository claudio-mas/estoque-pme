import { EstruturaDaEmpresa } from '@/components/estrutura-empresa';
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

  return <EstruturaDaEmpresa empresaId={id} nome={nome} papel={papel}>{children}</EstruturaDaEmpresa>;
}
