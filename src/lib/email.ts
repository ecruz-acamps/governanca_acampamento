import nodemailer from 'nodemailer';

// Envio de e-mail. Duas opções, e o sistema usa a primeira que estiver configurada:
//  1) SMTP do seu e-mail profissional: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (e EMAIL_FROM).
//  2) Resend (https://resend.com): RESEND_API_KEY (e EMAIL_FROM).
// EMAIL_FROM é o remetente, ex.: "Governança <nao-responda@seudominio.com.br>". Com SMTP, costuma ser o mesmo e-mail do SMTP_USER.

const usaSmtp = () => !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;

export function emailConfigurado(): boolean {
  return usaSmtp() ? true : !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

function remetente(): string {
  return process.env.EMAIL_FROM || `Governança <${process.env.SMTP_USER}>`;
}

/** Endereço público do sistema. Vem de variável de ambiente, nunca do cabeçalho da requisição (evita link adulterado). */
export function urlBase(): string {
  const fixa = process.env.APP_URL || process.env.NEXTAUTH_URL;
  if (fixa && !fixa.includes('localhost')) return fixa.replace(/\/+$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return (fixa ?? 'http://localhost:3000').replace(/\/+$/, '');
}

type Mensagem = { para: string; assunto: string; texto: string; html: string };

async function viaSmtp(m: Mensagem): Promise<boolean> {
  const porta = Number(process.env.SMTP_PORT || 465);
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: porta,
    // 465 usa TLS direto; 587 começa em texto e sobe para TLS (STARTTLS).
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : porta === 465,
    requireTLS: porta !== 465 && process.env.SMTP_INSECURE !== 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  await t.sendMail({ from: remetente(), to: m.para, subject: m.assunto, text: m.texto, html: m.html });
  return true;
}

async function viaResend(m: Mensagem): Promise<boolean> {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: remetente(), to: [m.para], subject: m.assunto, text: m.texto, html: m.html }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) {
    console.error('Falha ao enviar e-mail (Resend)', r.status, (await r.text()).slice(0, 300));
    return false;
  }
  return true;
}

export async function enviarEmail(m: Mensagem): Promise<boolean> {
  if (!emailConfigurado()) return false;
  try {
    return usaSmtp() ? await viaSmtp(m) : await viaResend(m);
  } catch (e) {
    console.error('Falha ao enviar e-mail', (e as Error)?.message ?? e);
    return false;
  }
}
