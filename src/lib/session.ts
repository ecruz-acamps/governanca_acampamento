import { cache } from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { run } from '@/lib/db';
import { can, type Papel, type Perm } from '@/lib/perms';

export type Usuario = {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
  precisaTrocar: boolean;
  associadoId: string | null;
  superadmin: boolean;
};

type Linha = {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
  precisa_trocar_senha: boolean;
  associado_id: string | null;
  superadmin: boolean;
};

/** Lê o usuário a cada requisição: desativar uma conta vale na hora. */
export const getUsuario = cache(async (): Promise<Usuario | null> => {
  const sessao = await getServerSession(authOptions);
  const info = sessao as unknown as { uid?: string; sso?: boolean } | null;
  const uid = info?.uid;
  if (!uid) return null;
  const [u] = await run(null, (tx) => tx<Linha[]>`
    select id, email, nome, papel, ativo, precisa_trocar_senha, associado_id, superadmin from gov.usuario where id = ${uid}
  `);
  if (!u || !u.ativo) return null;
  return { id: u.id, email: u.email, nome: u.nome, papel: u.papel, precisaTrocar: u.precisa_trocar_senha && !info?.sso, associadoId: u.associado_id, superadmin: u.superadmin };
});

export async function requireUser(opcoes?: { permitirTroca?: boolean }): Promise<Usuario> {
  const u = await getUsuario();
  if (!u) redirect('/login');
  if (u.precisaTrocar && !opcoes?.permitirTroca) redirect('/trocar-senha');
  return u;
}

export async function requirePerm(perm: Perm): Promise<Usuario> {
  const u = await requireUser();
  if (!can(u.papel, perm, u.superadmin)) {
    redirect('/?erro=' + encodeURIComponent('Você não tem permissão para esta área.'));
  }
  return u;
}

/** Área exclusiva do superadmin (apagar usuários, reiniciar o sistema). */
export async function requireSuperadmin(): Promise<Usuario> {
  const u = await requirePerm('usuarios:gerir');
  if (!u.superadmin) redirect('/usuarios?erro=' + encodeURIComponent('Somente o superadmin pode fazer isso.'));
  return u;
}

/** Área do associado: exige uma conta ligada a um cadastro de associado. */
export async function requireAssociado(): Promise<Usuario & { associadoId: string }> {
  const u = await requireUser();
  if (!u.associadoId) redirect('/?erro=' + encodeURIComponent('Sua conta não está ligada a um associado.'));
  return u as Usuario & { associadoId: string };
}
