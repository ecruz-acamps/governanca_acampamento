import { hash, verify } from '@node-rs/argon2';

// Argon2id (padrão da biblioteca) com parâmetros do mínimo recomendado pela OWASP.
const OPCOES = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashSenha(senha: string): Promise<string> {
  return hash(senha, OPCOES);
}

export async function verificarSenha(hashGuardado: string, senha: string): Promise<boolean> {
  try {
    return await verify(hashGuardado, senha);
  } catch {
    return false;
  }
}

// Quando o e-mail não existe, gasta o mesmo tempo de uma verificação real,
// para que a resposta não revele quais e-mails são cadastrados.
let falso: Promise<string> | null = null;
export async function gastarTempo(senha: string): Promise<void> {
  falso ??= hash('senha-inexistente-' + Math.random(), OPCOES);
  await verificarSenha(await falso, senha);
}

/** Política de senha: devolve a mensagem de erro, ou null se a senha é aceitável. */
export function validarSenha(senha: string, email?: string): string | null {
  if (senha.length < 12) return 'A senha precisa ter pelo menos 12 caracteres.';
  if (senha.length > 128) return 'A senha pode ter no máximo 128 caracteres.';
  if (!/[A-Za-zÀ-ÿ]/.test(senha)) return 'A senha precisa ter pelo menos uma letra.';
  if (!/[^A-Za-zÀ-ÿ]/.test(senha)) return 'A senha precisa ter pelo menos um número ou símbolo.';
  if (email && senha.toLowerCase().includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length >= 4) {
    return 'A senha não pode conter o seu e-mail.';
  }
  return null;
}
