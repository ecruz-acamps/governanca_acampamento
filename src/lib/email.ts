// Envio de e-mail pela API do Resend (https://resend.com). Para trocar de provedor, mude só este arquivo.
// Variáveis: RESEND_API_KEY (chave da API) e EMAIL_FROM (ex.: "Governança <nao-responda@seudominio.com.br>").

export function emailConfigurado(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

/** Endereço público do sistema. Vem de variável de ambiente, nunca do cabeçalho da requisição (evita link adulterado). */
export function urlBase(): string {
  const fixa = process.env.APP_URL || process.env.NEXTAUTH_URL;
  if (fixa && !fixa.includes('localhost')) return fixa.replace(/\/+$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return (fixa ?? 'http://localhost:3000').replace(/\/+$/, '');
}

export async function enviarEmail(m: { para: string; assunto: string; texto: string; html: string }): Promise<boolean> {
  if (!emailConfigurado()) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [m.para], subject: m.assunto, text: m.texto, html: m.html }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) {
      console.error('Falha ao enviar e-mail', r.status, (await r.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error('Falha ao enviar e-mail', e);
    return false;
  }
}
