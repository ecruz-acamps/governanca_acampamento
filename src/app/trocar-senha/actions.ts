'use server';

import { run } from '@/lib/db';
import { tentar, voltar } from '@/lib/acao';
import { hashSenha, validarSenha, verificarSenha } from '@/lib/password';
import { requireUser } from '@/lib/session';
import { redirect } from 'next/navigation';

export async function trocarSenha(formData: FormData) {
  const u = await requireUser({ permitirTroca: true });
  const atual = String(formData.get('atual') ?? '');
  const nova = String(formData.get('nova') ?? '');
  const repete = String(formData.get('repete') ?? '');

  if (nova !== repete) voltar('/trocar-senha', '', 'As senhas novas não conferem.');
  const problema = validarSenha(nova, u.email);
  if (problema) voltar('/trocar-senha', '', problema);
  if (nova === atual) voltar('/trocar-senha', '', 'A nova senha precisa ser diferente da atual.');

  const [linha] = await run(null, (tx) => tx<{ senha_hash: string | null }[]>`
    select senha_hash from gov.usuario where id = ${u.id}
  `);
  if (!linha?.senha_hash || !(await verificarSenha(linha.senha_hash, atual))) {
    voltar('/trocar-senha', '', 'A senha atual está incorreta.');
  }

  const novoHash = await hashSenha(nova);
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`
      update gov.usuario
         set senha_hash = ${novoHash}, senha_alterada_em = now(), precisa_trocar_senha = false
       where id = ${u.id}
    `);
  });
  if (erro) voltar('/trocar-senha', '', erro);
  redirect('/?ok=' + encodeURIComponent('Senha alterada.'));
}
