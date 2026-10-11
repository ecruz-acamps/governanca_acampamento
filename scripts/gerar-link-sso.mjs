// Gera um link de acesso (superadmin) válido por 2 minutos e de uso único.
// Uso:  SSO_SECRET=... node scripts/gerar-link-sso.mjs admin@dominio https://seu-site.vercel.app
import { createHmac, randomBytes } from 'node:crypto';

const [email, base] = process.argv.slice(2);
const segredo = process.env.SSO_SECRET ?? '';
if (!email || !base || segredo.length < 32) {
  console.error('Uso: SSO_SECRET=<32+ caracteres> node scripts/gerar-link-sso.mjs <email-admin> <https://site>');
  process.exit(1);
}
const corpo = Buffer.from(
  JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + 120, jti: randomBytes(16).toString('hex') }),
).toString('base64url');
const assinatura = createHmac('sha256', segredo).update(corpo).digest('base64url');
console.log(`${base.replace(/\/$/, '')}/sso#t=${corpo}.${assinatura}`);
