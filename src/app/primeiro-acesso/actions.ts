'use server';

import { timingSafeEqual } from 'node:crypto';
import { redirect } from 'next/navigation';
import { run } from '@/lib/db';
import { msg } from '@/lib/form';
import { hashSenha, validarSenha } from '@/lib/password';

function erro(texto: string): never {
  redirect('/primeiro-acesso?erro=' + msg(texto));
}

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Define a primeira senha de um usuário que ainda não tem senha.
 * Só funciona com o código secreto SETUP_TOKEN (cadastrado na Vercel) e
 * só para contas sem senha — depois disso a tela não serve mais para nada.
 */
export async function definirPrimeiraSenha(formData: FormData) {
  const esperado = process.env.SETUP_TOKEN ?? '';
  if (esperado.length < 16) erro('Primeiro acesso desativado.');

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const codigo = String(formData.get('codigo') ?? '');
  const nova = String(formData.get('nova') ?? '');
  const repete = String(formData.get('repete') ?? '');

  if (!iguais(codigo, esperado)) erro('Código de acesso inválido.');
  if (nova !== repete) erro('As senhas não conferem.');
  const problema = validarSenha(nova, email);
  if (problema) erro(problema);

  const h = await hashSenha(nova);
  const alterou = await run(null, (tx) => tx`
    update gov.usuario
       set senha_hash = ${h}, senha_alterada_em = now(), precisa_trocar_senha = false,
           tentativas_falhas = 0, bloqueado_ate = null
     where email = ${email} and ativo and senha_hash is null
    returning id
  `);
  if (alterou.length === 0) erro('Esse e-mail não existe, está inativo ou já tem senha.');
  redirect('/login');
}
