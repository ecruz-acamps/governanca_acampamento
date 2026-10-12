'use server';

import { run } from '@/lib/db';
import { hashSenha, validarSenha } from '@/lib/password';
import { hashToken } from '@/lib/tokens';

const INVALIDO = 'Este link é inválido ou já expirou. Peça um novo em "Esqueci minha senha".';

/** O token vem do fragmento da URL (não vai para logs do servidor). Uso único, validade de 30 minutos. */
export async function redefinirComToken(token: string, nova: string, repete: string): Promise<{ erro?: string }> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return { erro: INVALIDO };
  if (nova !== repete) return { erro: 'As senhas não conferem.' };
  const h = hashToken(token);

  const [linha] = await run(null, (tx) => tx<{ id: string; usuario_id: string; email: string }[]>`
    select r.id::text, r.usuario_id::text, u.email
      from gov.reset_senha r join gov.usuario u on u.id = r.usuario_id
     where r.token_hash = ${h} and r.usado_em is null and r.expira_em > now() and u.ativo
  `);
  if (!linha) return { erro: INVALIDO };

  const problema = validarSenha(nova, linha.email);
  if (problema) return { erro: problema };
  const novoHash = await hashSenha(nova);

  try {
    const ok = await run(linha.usuario_id, async (tx) => {
      // Marca o token como usado de forma atômica: se duas pessoas usarem o mesmo link, só uma passa.
      const r = await tx`
        update gov.reset_senha set usado_em = now()
         where id = ${linha.id}::bigint and usado_em is null and expira_em > now() returning id
      `;
      if (r.length === 0) return false;
      await tx`update gov.reset_senha set usado_em = now() where usuario_id = ${linha.usuario_id}::uuid and usado_em is null`;
      await tx`
        update gov.usuario
           set senha_hash = ${novoHash}, senha_alterada_em = now(), precisa_trocar_senha = false,
               tentativas_falhas = 0, bloqueado_ate = null
         where id = ${linha.usuario_id}::uuid
      `;
      await tx`
        insert into gov.acesso_log (usuario_id, email, sucesso, motivo)
        values (${linha.usuario_id}::uuid, ${linha.email}, true, 'senha redefinida por e-mail')
      `;
      return true;
    });
    return ok ? {} : { erro: INVALIDO };
  } catch (e) {
    console.error('Erro ao redefinir senha', e);
    return { erro: 'Não foi possível salvar a nova senha. Tente de novo.' };
  }
}
