import { createHmac, timingSafeEqual } from 'node:crypto';

export type SsoPayload = { email: string; exp: number; jti: string };

const b64 = (b: Buffer) => b.toString('base64url');

/** Valida "payload.assinatura" (HMAC-SHA256). Lança Error com o motivo se for inválido. */
export function verificarTokenSso(token: string): SsoPayload {
  const segredo = process.env.SSO_SECRET ?? '';
  if (segredo.length < 32) throw new Error('sso_desativado');

  const partes = token.split('.');
  if (partes.length !== 2) throw new Error('formato');
  const [corpo, assinatura] = partes;

  const esperada = b64(createHmac('sha256', segredo).update(corpo).digest());
  const a = Buffer.from(assinatura);
  const e = Buffer.from(esperada);
  if (a.length !== e.length || !timingSafeEqual(a, e)) throw new Error('assinatura');

  let p: Partial<SsoPayload>;
  try {
    p = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));
  } catch {
    throw new Error('formato');
  }
  if (typeof p.email !== 'string' || typeof p.jti !== 'string' || typeof p.exp !== 'number') {
    throw new Error('formato');
  }
  if (p.jti.length < 16 || p.jti.length > 100) throw new Error('formato');
  const agora = Math.floor(Date.now() / 1000);
  if (p.exp < agora) throw new Error('expirado');
  if (p.exp > agora + 300) throw new Error('validade_longa_demais'); // no máx. 5 min à frente
  return { email: p.email.trim().toLowerCase(), exp: p.exp, jti: p.jti };
}
