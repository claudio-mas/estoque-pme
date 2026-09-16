/**
 * Conferência otimista: sem sessão, vai para /entrar antes de renderizar.
 *
 * É só a primeira linha, e o guia do Next.js diz por quê: o proxy não é
 * autorização. A conferência que vale é a do DAL (`naEmpresa`), o mais perto
 * possível do dado, em toda página e toda action.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIES_DE_SESSAO = ['authjs.session-token', '__Secure-authjs.session-token'];

export function proxy(request: NextRequest) {
  const temSessao = COOKIES_DE_SESSAO.some((nome) => request.cookies.has(nome));
  if (temSessao) return NextResponse.next();
  const entrar = new URL('/entrar', request.url);
  entrar.searchParams.set('voltar', request.nextUrl.pathname);
  return NextResponse.redirect(entrar);
}

export const config = {
  // Tudo, menos entrar, a API de auth e os estáticos.
  matcher: ['/((?!entrar|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
