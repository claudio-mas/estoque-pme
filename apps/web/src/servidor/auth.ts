/**
 * Auth.js: magic link por e-mail, sessão no nosso Postgres.
 *
 * Sem senha (ADR-0013). Senha traria reset, política e um hash nosso para
 * errar; e o provedor Credentials do Auth.js só funciona com sessão JWT, o que
 * mataria a promessa de "PII no nosso Postgres". Magic link é um provedor de
 * e-mail e nada mais — e a PME brasileira já vive de e-mail.
 *
 * O transporte é SMTP genérico via Nodemailer, escolhido no deploy: o provedor
 * de e-mail é operador de dado pessoal, e a nota de LGPD do CLAUDE.md existe
 * para não abrir a conversa de transferência internacional. Sem `SMTP_URL` —
 * desenvolvimento —, o link vai para o console, e o login funciona sem conta
 * em lugar nenhum.
 */
import 'server-only';
import NextAuth from 'next-auth';
import Nodemailer from 'next-auth/providers/nodemailer';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { schema } from '@estoque-pme/dados';
import { banco } from './banco';

const SMTP_URL = process.env['SMTP_URL'];
const REMETENTE = process.env['EMAIL_DE'] ?? 'Estoque PME <nao-responda@localhost>';

export const { handlers, auth, signIn, signOut } = NextAuth(async () => ({
  adapter: DrizzleAdapter(await banco(), {
    usersTable: schema.usuario,
    accountsTable: schema.conta,
    sessionsTable: schema.sessao,
    verificationTokensTable: schema.tokenDeVerificacao,
  }),
  session: { strategy: 'database' },
  pages: { signIn: '/entrar', verifyRequest: '/entrar/verifique' },
  providers: [
    Nodemailer({
      from: REMETENTE,
      ...(SMTP_URL === undefined || SMTP_URL === ''
        ? {
            // Sem SMTP, o link sai no terminal. É só para desenvolvimento, e é
            // deliberado: o login tem de funcionar antes de existir conta de
            // e-mail em lugar nenhum. O `jsonTransport` existe porque o
            // provedor exige um `server` mesmo quando o envio é nosso.
            server: { jsonTransport: true },
            sendVerificationRequest({ identifier, url }) {
              console.log(`\n[estoque-pme] link de acesso para ${identifier}:\n${url}\n`);
            },
          }
        : { server: SMTP_URL }),
    }),
  ],
}));
