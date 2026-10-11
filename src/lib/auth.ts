import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { run } from '@/lib/db';
import { gastarTempo, verificarSenha } from '@/lib/password';
import { segredoSessao } from '@/lib/segredo';
import { verificarTokenSso } from '@/lib/sso';

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

function diagnosticoBanco(e: unknown): string {
  const c = String((e as { code?: string })?.code ?? '');
  const m = String((e as { message?: string })?.message ?? '');
  if (/formato inválido/.test(m)) return 'banco: DATABASE_URL em formato inválido (confira o texto colado na Vercel)';
  if (/DATABASE_URL|POSTGRES_URL/.test(m)) return 'banco: nenhuma variável de conexão (POSTGRES_URL/DATABASE_URL) configurada';
  if (c === '28P01' || /password authentication/i.test(m)) return 'banco: senha do banco incorreta';
  if (/tenant or user not found/i.test(m)) return 'banco: projeto ou usuário do pooler não encontrado';
  if (c === '42P01' || c === '3F000') return 'banco: tabelas gov não existem neste banco (projeto errado?)';
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|CONNECT_TIMEOUT/.test(c + m)) return 'banco: sem conexão com o servidor';
  return 'banco: erro ' + (c || 'desconhecido');
}

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
      id: 'sso',
      name: 'Acesso pelo sistema interno',
      credentials: { token: {} },
      async authorize(credenciais, req) {
        const cab = (req?.headers ?? {}) as Record<string, string | string[] | undefined>;
        const ip = String(cab['x-forwarded-for'] ?? '').split(',')[0].trim() || 'desconhecido';
        const agente = String(cab['user-agent'] ?? '');
        const token = String(credenciais?.token ?? '').slice(0, 2000);
        let email = '';
        try {
          const p = verificarTokenSso(token);
          email = p.email;
          const r = await run(null, async (tx) => {
            const [u] = await tx<{ id: string; nome: string }[]>`
              select id, nome from gov.usuario where email = ${p.email} and ativo and papel = 'admin'
            `;
            if (!u) return { erro: 'usuario_nao_admin' as const };
            // uso único: o mesmo link não vale duas vezes
            const usado = await tx`
              insert into gov.sso_uso (jti, email) values (${p.jti}, ${p.email})
              on conflict (jti) do nothing returning jti
            `;
            if (usado.length === 0) return { erro: 'reutilizado' as const };
            await tx`update gov.usuario set ultimo_acesso = now() where id = ${u.id}`;
            return { u };
          });
          if ('erro' in r) throw new Error(r.erro);
          await registrar(r.u.id, email, true, 'sso_ok', ip, agente);
          return { id: r.u.id, email, name: r.u.nome, sso: true } as never;
        } catch (e) {
          const motivo = e instanceof Error ? e.message : 'erro';
          console.error('SSO_FALHA', motivo);
          await registrar(null, email || 'sso', false, 'sso_falha:' + motivo, ip, agente);
          return null;
        }
      },
    }),
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

        let u: Linha | undefined;
        try {
          [u] = await run(null, (tx) => tx<Linha[]>`
            select id, email, nome, senha_hash, ativo, tentativas_falhas,
                   (bloqueado_ate is not null and bloqueado_ate > now()) as bloqueado
              from gov.usuario where email = ${email}
          `);
        } catch (e) {
          console.error('LOGIN_ERRO_BANCO', e);
          throw new Error(diagnosticoBanco(e));
        }

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
      if (user) {
        token.uid = user.id;
        token.sso = (user as unknown as { sso?: boolean }).sso === true;
      }
      return token;
    },
    async session({ session, token }) {
      const x = session as unknown as { uid?: string; sso?: boolean };
      x.uid = token.uid as string | undefined;
      x.sso = token.sso === true;
      return session;
    },
  },
};
