import { signIn } from '@/servidor/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Entrar: um e-mail, um link.
 *
 * Sem senha (ADR-0013). O formulário chama a Server Action do Auth.js direto;
 * o provedor manda o link — ou, em desenvolvimento, imprime no terminal.
 */
export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ voltar?: string }>;
}) {
  const { voltar } = await searchParams;

  async function enviarLink(dados: FormData) {
    'use server';
    const email = String(dados.get('email') ?? '').trim();
    await signIn('nodemailer', { email, redirectTo: voltar ?? '/' });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <header>
        <h1 className="text-2xl font-semibold">Estoque PME</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe seu e-mail. Você recebe um link de acesso — sem senha.
        </p>
      </header>
      <form action={enviarLink} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          E-mail
          <Input
            type="email"
            name="email"
            required
            autoComplete="email"
          />
        </label>
        <Button type="submit">
          Enviar link de acesso
        </Button>
      </form>
    </main>
  );
}
