import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { run } from '@/lib/db';
import { gastarTempo, verificarSenha } from '@/lib/password';
import { segredoSessao } from '@/lib/segredo';

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

type Linha = {
  id: string;
  email: string;
  nome: string;
  senha_hash: string | null;
  ativo: boolean;
  tentativas_falhas: number;
  bloqueado: boolean;
};

async function registrar(
  usuarioId: string | null,
  email: string,
  sucesso: boolean,
  motivo: string,
  ip: string,
  agente: string,
) {
  try {
    await run(null, (tx) => tx`
      insert into gov.acesso_log (usuario_id, email, sucesso, motivo, ip, user_agent)
      values (${usuarioId}, ${email.slice(0, 200)}, ${sucesso}, ${motivo}, ${ip.slice(0, 80)}, ${agente.slice(0, 300)})
    `);
  } catch (e) {
    console.error('Falha ao registrar acesso', e);
  }
}

export const authOptions: NextAuthOptions = {
  secret: segredoSessao(),
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'E-mail e senha',
      credentials: { email: {}, senha: {} },
      async authorize(credenciais, req) {
        const email = String(credenciais?.email ?? '').trim().toLowerCase();
        const senha = String(credenciais?.senha ?? '');
        const cab = (req?.headers ?? {}) as Record<string, string | string[] | undefined>;
        const ip = String(cab['x-forwarded-for'] ?? '').split(',')[0].trim() || 'desconhecido';
        const agente = String(cab['user-agent'] ?? '');
        if (!email || !senha || senha.length > 200) return null;

        const [u] = await run(null, (tx) => tx<Linha[]>`
          select id, email, nome, senha_hash, ativo, tentativas_falhas,
                 (bloqueado_ate is not null and bloqueado_ate > now()) as bloqueado
            from gov.usuario where email = ${email}
        `);

        if (!u || !u.ativo || !u.senha_hash) {
          await gastarTempo(senha);
          await registrar(u?.id ?? null, email, false, !u ? 'usuario_inexistente' : 'sem_acesso', ip, agente);
          return null;
        }
        if (u.bloqueado) {
          await registrar(u.id, email, false, 'conta_bloqueada', ip, agente);
          return null;
        }

        const ok = await verificarSenha(u.senha_hash, senha);
        if (!ok) {
          await run(null, (tx) => tx`
            update gov.usuario
               set tentativas_falhas = tentativas_falhas + 1,
                   bloqueado_ate = case when tentativas_falhas + 1 >= ${MAX_TENTATIVAS}
                                        then now() + make_interval(mins => ${BLOQUEIO_MINUTOS})
                                        else bloqueado_ate end
             where id = ${u.id}
          `);
          await registrar(u.id, email, false, 'senha_incorreta', ip, agente);
          return null;
        }

        await run(null, (tx) => tx`
          update gov.usuario
             set tentativas_falhas = 0, bloqueado_ate = null, ultimo_acesso = now()
           where id = ${u.id}
        `);
        await registrar(u.id, email, true, 'ok', ip, agente);
        return { id: u.id, email: u.email, name: u.nome };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      (session as unknown as { uid?: string }).uid = token.uid as string | undefined;
      return session;
    },
  },
};
