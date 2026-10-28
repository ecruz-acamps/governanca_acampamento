'use server';

import { randomBytes } from 'crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { run } from '@/lib/db';
import { emailConfigurado, enviarEmail, urlBase } from '@/lib/email';
import { msg } from '@/lib/form';
import { hashToken } from '@/lib/tokens';

const MINUTOS_VALIDADE = 30;
const MAX_POR_HORA_POR_USUARIO = 3;
const MAX_GERAL_EM_10_MIN = 30;
const RESPOSTA = 'Se esse e-mail estiver cadastrado, enviamos um link para criar uma nova senha. Ele vale por 30 minutos. Confira também a caixa de spam.';

export async function pedirRedefinicao(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect('/esqueci-senha?erro=' + msg('Digite um e-mail válido.'));
  if (!emailConfigurado()) {
    redirect('/esqueci-senha?erro=' + msg('O envio de e-mail ainda não foi configurado. Peça a um administrador para redefinir a sua senha.'));
  }

  const ip = (headers().get('x-forwarded-for') ?? '').split(',')[0].trim().slice(0, 80) || null;
  const token = randomBytes(32).toString('base64url');
  let enviar = false;
  let usuarioId = '';

  try {
    await run(null, async (tx) => {
      const [{ geral }] = await tx<{ geral: number }[]>`
        select count(*)::int as geral from gov.reset_senha where criado_em > now() - interval '10 minutes'
      `;
      if (geral >= MAX_GERAL_EM_10_MIN) return;
      const [u] = await tx<{ id: string }[]>`select id from gov.usuario where email = ${email} and ativo`;
      if (!u) return;
      const [{ n }] = await tx<{ n: number }[]>`
        select count(*)::int as n from gov.reset_senha where usuario_id = ${u.id} and criado_em > now() - interval '1 hour'
      `;
      if (n >= MAX_POR_HORA_POR_USUARIO) return;
      await tx`
        insert into gov.reset_senha (usuario_id, token_hash, expira_em, ip)
        values (${u.id}, ${hashToken(token)}, now() + ${MINUTOS_VALIDADE + ' minutes'}::interval, ${ip})
      `;
      usuarioId = u.id;
      enviar = true;
    });
    if (enviar) {
      const link = `${urlBase()}/redefinir-senha#t=${token}`;
      const r = await enviarEmail({
        para: email,
        assunto: 'Governança — crie uma nova senha',
        texto:
          `Recebemos um pedido para criar uma nova senha no sistema de Governança da Associação dos Campistas São Padre Pio.\n\n` +
          `Abra o link abaixo (vale por ${MINUTOS_VALIDADE} minutos e só pode ser usado uma vez):\n${link}\n\n` +
          `Se não foi você, ignore este e-mail: a sua senha continua a mesma.`,
        html:
          `<div style="font-family:system-ui,sans-serif;max-width:480px;color:#17231f">` +
          `<h2 style="margin:0 0 12px">Crie uma nova senha</h2>` +
          `<p>Recebemos um pedido para criar uma nova senha no sistema de Governança da Associação dos Campistas São Padre Pio.</p>` +
          `<p><a href="${link}" style="display:inline-block;background:#014caa;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Criar nova senha</a></p>` +
          `<p style="color:#5b6862;font-size:14px">O link vale por ${MINUTOS_VALIDADE} minutos e só pode ser usado uma vez.<br>Se não foi você, ignore este e-mail: a sua senha continua a mesma.</p></div>`,
      });
      await run(null, (tx) => tx`
        insert into gov.acesso_log (usuario_id, email, sucesso, motivo, ip)
        values (${usuarioId}::uuid, ${email}, ${r.ok}, ${r.ok ? 'link de redefinição de senha enviado' : 'falha ao enviar e-mail de redefinição: ' + r.erro}, ${ip})
      `);
    } else {
      // Mesmo tempo de resposta quando o e-mail não existe, para não revelar quem é cadastrado.
      await new Promise((r) => setTimeout(r, 700));
    }
  } catch (e) {
    console.error('Erro ao pedir redefinição de senha', e);
  }
  redirect('/esqueci-senha?ok=' + msg(RESPOSTA));
}
