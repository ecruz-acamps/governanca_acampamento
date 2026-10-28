import { getUsuario, type Usuario } from '@/lib/session';
import { can, type Perm } from '@/lib/perms';
import { isUuid } from '@/lib/form';
import { run } from '@/lib/db';

/** Confere login, permissão e id; devolve o usuário ou uma resposta de erro. */
export async function guardaDoc(perm: Perm, id: string): Promise<{ u: Usuario } | { erro: Response }> {
  const u = await getUsuario();
  if (!u || u.precisaTrocar) return { erro: new Response('Não autenticado', { status: 401 }) };
  if (!can(u.papel, perm, u.superadmin)) return { erro: new Response('Sem permissão', { status: 403 }) };
  if (!isUuid(id)) return { erro: new Response('Documento não encontrado', { status: 404 }) };
  return { u };
}

/** Quem ocupa o cargo agora (para as assinaturas). */
export async function ocupante(userId: string, cargo: string): Promise<string | null> {
  const [r] = await run(userId, (tx) => tx<{ nome: string }[]>`
    select a.nome from gov.mandato m join gov.associado a on a.id = m.associado_id
     where m.cargo = ${cargo} and m.situacao = 'ativo' and current_date between m.inicio and m.fim
     order by m.inicio desc limit 1`);
  return r?.nome ?? null;
}
