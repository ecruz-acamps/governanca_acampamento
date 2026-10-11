import { withAuth } from 'next-auth/middleware';

// Exige sessão em todas as rotas, exceto login e a API de autenticação.
export default withAuth({ pages: { signIn: '/login' } });

export const config = {
  matcher: ['/((?!login|primeiro-acesso|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
