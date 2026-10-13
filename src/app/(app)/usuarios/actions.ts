'use server';

import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { isUuid, nz, uuidOuNulo } from '@/lib/form';
import { hashSenha, validarSenha, verificarSenha } from '@/lib/password';
import { PAPEIS, type Papel } from '@/lib/perms';
import { requirePerm, requireSuperadmin } from '@/lib/session';

export async function criarUsuario(formData: FormData) {
  const u = await requirePerm('usuarios:gerir');
  const email = nz(formData.get('email'))?.toLowerCase();
  const nome = nz(formData.get('nome'));
  const papel = nz(formData.get('papel')) as Papel | null;
  const senha = String(formData.get('senha') ?? '');
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) voltar('/usuarios', '', 'E-mail inválido.');
  if (!nome) voltar('/usuarios', '', 'Informe o nome.');
  if (!papel || !PAPEIS.includes(papel)) voltar('/usuarios', '', 'Escolha o papel.');
  const problema = validarSenha(senha, email);
  if (problema) voltar('/usuarios', '', problema);

  const h = await hashSenha(senha);
  const assoc = uuidOuNulo(formData.get('associado_id'));
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`
      insert into gov.usuario (email, nome, papel, associado_id, senha_hash, senha_alterada_em, precisa_trocar_senha)
      values (${email}, ${nome}, ${papel}, ${assoc}, ${h}, now(), true)
    `);
  });
  voltar('/usuarios', 'Usuário criado. Ele deverá trocar a senha no primeiro acesso.', erro);
}

export async function redefinirSenha(formData: FormData) {
  const u = await requirePerm('usuarios:gerir');
  const id = nz(formData.get('id'));
  const senha = String(formData.get('senha') ?? '');
  if (!isUuid(id)) voltar('/usuarios', '', 'Usuário inválido.');
  const [alvo] = await run(null, (tx) => tx<{ email: string; superadmin: boolean }[]>`select email, superadmin from gov.usuario where id = ${id}`);
  if (!alvo) voltar('/usuarios', '', 'Usuário não encontrado.');
  if (alvo.superadmin && id !== u.id) voltar('/usuarios', '', 'Somente o superadmin altera a própria conta.');
  const problema = validarSenha(senha, alvo.email);
  if (problema) voltar('/usuarios', '', problema);
  const h = await hashSenha(senha);
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`
      update gov.usuario
         set senha_hash = ${h}, senha_alterada_em = now(), precisa_trocar_senha = true,
             tentativas_falhas = 0, bloqueado_ate = null
       where id = ${id}
    `);
  });
  voltar('/usuarios', 'Senha temporária definida. A pessoa trocará no próximo acesso.', erro);
}

export async function alternarAtivo(formData: FormData) {
  const u = await requirePerm('usuarios:gerir');
  const id = nz(formData.get('id'));
  if (!isUuid(id)) voltar('/usuarios', '', 'Usuário inválido.');
  if (id === u.id) voltar('/usuarios', '', 'Você não pode desativar a própria conta.');
  const [alvo] = await run(null, (tx) => tx<{ superadmin: boolean }[]>`select superadmin from gov.usuario where id = ${id}`);
  if (alvo?.superadmin) voltar('/usuarios', '', 'A conta do superadmin não pode ser desativada.');
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`update gov.usuario set ativo = not ativo where id = ${id}`);
  });
  voltar('/usuarios', 'Situação do acesso alterada.', erro);
}

export async function desbloquear(formData: FormData) {
  const u = await requirePerm('usuarios:gerir');
  const id = nz(formData.get('id'));
  if (!isUuid(id)) voltar('/usuarios', '', 'Usuário inválido.');
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`update gov.usuario set tentativas_falhas = 0, bloqueado_ate = null where id = ${id}`);
  });
  voltar('/usuarios', 'Conta desbloqueada.', erro);
}

/** Só o superadmin apaga usuários (e nunca a si mesmo). */
export async function excluirUsuario(formData: FormData) {
  const u = await requireSuperadmin();
  const id = nz(formData.get('id'));
  if (!isUuid(id)) voltar('/usuarios', '', 'Usuário inválido.');
  if (id === u.id) voltar('/usuarios', '', 'O superadmin não pode ser apagado.');
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`delete from gov.usuario where id = ${id}`);
  });
  voltar('/usuarios', 'Usuário apagado.', erro);
}

/**
 * Reinicia a operação: apaga TODOS os dados e mantém só o superadmin.
 * Exige digitar a frase de confirmação e a senha do superadmin.
 */
export async function reiniciarSistema(formData: FormData) {
  const u = await requireSuperadmin();
  if (String(formData.get('confirmacao') ?? '').trim() !== 'APAGAR TUDO') {
    voltar('/usuarios', '', 'Digite exatamente APAGAR TUDO para confirmar.');
  }
  const senha = String(formData.get('senha') ?? '');
  const [conta] = await run(null, (tx) => tx<{ senha_hash: string | null }[]>`select senha_hash from gov.usuario where id = ${u.id}`);
  if (!conta?.senha_hash || !(await verificarSenha(conta.senha_hash, senha))) {
    voltar('/usuarios', '', 'Senha incorreta.');
  }
  const erro = await tentar(async () => {
    await run(null, (tx) => tx`select gov.resetar_sistema(${u.id}::uuid)`);
  });
  voltar('/usuarios', 'Sistema reiniciado. Só a conta do superadmin foi mantida.', erro);
}
