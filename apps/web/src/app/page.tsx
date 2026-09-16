import Link from 'next/link';
import { minhasEmpresas, sessaoOuEntrar } from '@/servidor/acesso';
import { signOut } from '@/servidor/auth';

/**
 * A troca de contexto (RF-23): as empresas do usuário, e só elas.
 *
 * A empresa corrente vive na URL, não em cookie: estado escondido é o que faz o
 * gestor abrir o balancete da empresa errada e não perceber. Daqui, cada link
 * é auditável e o botão "voltar" funciona.
 */
export default async function Inicio() {
  const sessao = await sessaoOuEntrar();
  const empresas = await minhasEmpresas();

  async function sair() {
    'use server';
    await signOut({ redirectTo: '/entrar' });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Suas empresas</h1>
        <form action={sair}>
          <button type="submit" className="text-sm text-stone-600 underline">
            Sair ({sessao.email})
          </button>
        </form>
      </header>

      {empresas.length === 0 ? (
        <p className="rounded border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          Nenhuma empresa ligada a este e-mail. O acesso é dado por quem já administra a
          empresa — peça a ele, ou, no primeiro cadastro, use o script de semente.
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded border border-stone-200 bg-white">
          {empresas.map((v) => (
            <li key={v.empresaId}>
              <Link
                href={`/empresas/${v.empresaId}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-stone-50"
              >
                <span>{v.nome}</span>
                <span className="text-xs uppercase tracking-wide text-stone-500">{v.papel}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
