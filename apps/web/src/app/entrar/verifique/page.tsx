export default function Verifique() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 px-4">
      <h1 className="text-2xl font-semibold">Confira seu e-mail</h1>
      <p className="text-sm text-stone-600">
        Enviamos um link de acesso. Ele vale por um tempo curto e funciona uma vez só.
      </p>
      <p className="text-xs text-stone-500">
        Em desenvolvimento, sem SMTP configurado, o link aparece no terminal do servidor.
      </p>
    </main>
  );
}
