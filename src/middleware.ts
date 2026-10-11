import { withAuth } from 'next-auth/middleware';
import { segredoSessao } from '@/lib/segredo';

// Exige sessão em todas as rotas, exceto login e a API de autenticação.
export default withAuth({ pages: { signIn: '/login' }, secret: segredoSessao() });

export const config = {
  matcher: ['/((?!login|primeiro-acesso|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
