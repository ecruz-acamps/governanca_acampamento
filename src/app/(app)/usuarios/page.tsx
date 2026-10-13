import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { fmtDataHora } from '@/lib/format';
import { PAPEIS, PAPEL_LABEL } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { alternarAtivo, criarUsuario, desbloquear, excluirUsuario, redefinirSenha, reiniciarSistema } from './actions';

type Lin = {
  id: string; email: string; nome: string; papel: string; ativo: boolean; ultimo_acesso: string | null;
  tem_senha: boolean; precisa_trocar_senha: boolean; bloqueado: boolean; superadmin: boolean;
};

export default async function UsuariosPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePerm('usuarios:gerir');
  const { usuarios, associados } = await run(u.id, async (tx) => {
    const usuarios = await tx<Lin[]>`
      select id, email, nome, papel::text, ativo, ultimo_acesso, (senha_hash is not null) as tem_senha,
             precisa_trocar_senha, (bloqueado_ate is not null and bloqueado_ate > now()) as bloqueado, superadmin
        from gov.usuario order by nome
    `;
    const associados = await tx<{ id: string; nome: string }[]>`
      select id, nome from gov.associado
       where status in ('associado','suspenso') and id not in (select associado_id from gov.usuario where associado_id is not null)
       order by nome
    `;
    return { usuarios, associados };
  });

  return (
    <>
      <PageHead titulo="Usuários" sub="Quem pode entrar no sistema e com qual papel. As senhas são guardadas apenas como hash." />
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      <form action={criarUsuario} className="card">
        <h2>Novo usuário</h2>
        <div className="form-grid">
          <Campo label="Nome"><input type="text" name="nome" required /></Campo>
          <Campo label="E-mail"><input type="email" name="email" required /></Campo>
          <Campo label="Papel">
            <select name="papel" defaultValue="secretario">
              {PAPEIS.map((p) => <option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
            </select>
          </Campo>
          <Campo label="Associado ligado (opcional)">
            <select name="associado_id" defaultValue="">
              <option value="">—</option>
              {associados.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </Campo>
          <Campo label="Senha temporária" dica="Mín. 12 caracteres. A pessoa troca no primeiro acesso." className="larga">
            <input type="password" name="senha" autoComplete="new-password" minLength={12} required />
          </Campo>
        </div>
        <div style={{ marginTop: 14 }}><button className="btn" type="submit">Criar usuário</button></div>
      </form>

      <div className="card tabela">
        <h2>Usuários cadastrados</h2>
        <table>
          <thead><tr><th>Usuário</th><th>Papel</th><th>Situação</th><th>Último acesso</th><th>Ações</th></tr></thead>
          <tbody>
            {usuarios.map((x) => (
              <tr key={x.id}>
                <td>{x.nome}<div className="muted">{x.email}</div></td>
                <td>{PAPEL_LABEL[x.papel as keyof typeof PAPEL_LABEL]}</td>
                <td>
                  <div className="acoes">
                    {x.superadmin && <Chip tom="ok">superadmin</Chip>}
                    {x.ativo ? <Chip tom="ok">ativo</Chip> : <Chip>inativo</Chip>}
                    {!x.tem_senha && <Chip tom="warn">sem senha</Chip>}
                    {x.tem_senha && x.precisa_trocar_senha && <Chip tom="warn">senha temporária</Chip>}
                    {x.bloqueado && <Chip tom="bad">bloqueado</Chip>}
                  </div>
                </td>
                <td>{fmtDataHora(x.ultimo_acesso)}</td>
                <td>
                  <div className="acoes">
                    {(!x.superadmin || x.id === u.id) && (
                    <form action={redefinirSenha} className="acoes">
                      <input type="hidden" name="id" value={x.id} />
                      <input type="password" name="senha" placeholder="Nova senha temporária" autoComplete="new-password" minLength={12} style={{ width: 190 }} required />
                      <button className="btn sec mini" type="submit">Redefinir</button>
                    </form>
                    )}
                    {x.bloqueado && (
                      <form action={desbloquear}><input type="hidden" name="id" value={x.id} />
                        <button className="btn sec mini" type="submit">Desbloquear</button></form>
                    )}
                    {u.superadmin && !x.superadmin && (
                      <form action={excluirUsuario}><input type="hidden" name="id" value={x.id} />
                        <button className="btn perigo mini" type="submit">Apagar</button></form>
                    )}
                    {x.id !== u.id && !x.superadmin && (
                      <form action={alternarAtivo}><input type="hidden" name="id" value={x.id} />
                        <button className={`btn mini ${x.ativo ? 'perigo' : 'sec'}`} type="submit">{x.ativo ? 'Desativar' : 'Reativar'}</button></form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {u.superadmin && (
        <form action={reiniciarSistema} className="card" style={{ borderColor: 'var(--bad-ink)' }}>
          <h2 style={{ color: 'var(--bad-ink)' }}>Reiniciar o sistema</h2>
          <p>
            Apaga <b>todos</b> os dados (associados, assembleias, reuniões, eleições e votos, financeiro, patrimônio,
            convênios, prestações, missões, auditoria e os demais usuários) e deixa só a sua conta de superadmin.
            Não tem volta. Faça um backup no Supabase antes, se houver qualquer dado que importe.
          </p>
          <div className="form-grid">
            <Campo label="Digite APAGAR TUDO"><input type="text" name="confirmacao" autoComplete="off" required /></Campo>
            <Campo label="Sua senha de superadmin"><input type="password" name="senha" autoComplete="current-password" required /></Campo>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn perigo" type="submit">Apagar tudo e reiniciar</button></div>
        </form>
      )}
    </>
  );
}
