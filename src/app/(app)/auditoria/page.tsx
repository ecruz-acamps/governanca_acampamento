import { Chip, PageHead } from '@/components/ui';
import { run } from '@/lib/db';
import { fmtDataHora } from '@/lib/format';
import { requirePerm } from '@/lib/session';

type Aud = {
  id: string; tabela: string; operacao: string; antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null; em: string; autor: string | null;
};

const IGNORAR = new Set(['atualizado_em', 'criado_em']);

function alterados(a: Aud): string {
  if (a.operacao === 'INSERT') return 'registro criado';
  if (a.operacao === 'DELETE') return 'registro excluído';
  const antes = a.antes ?? {};
  const depois = a.depois ?? {};
  const campos = Object.keys(depois).filter(
    (k) => !IGNORAR.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(depois[k]),
  );
  return campos.length ? campos.join(', ') : '—';
}

export default async function AuditoriaPage({ searchParams }: { searchParams: { tabela?: string } }) {
  const u = await requirePerm('auditoria:ler');
  const tabela = (searchParams.tabela ?? '').replace(/[^a-z_]/g, '').slice(0, 40);

  const { registros, acessos, tabelas } = await run(u.id, async (tx) => {
    const registros = await tx<Aud[]>`
      select a.id::text, a.tabela, a.operacao, a.antes, a.depois, a.em, us.nome as autor
        from gov.auditoria a left join gov.usuario us on us.id::text = a.usuario
       ${tabela ? tx`where a.tabela = ${tabela}` : tx``}
       order by a.id desc limit 200
    `;
    const acessos = await tx<{ em: string; email: string; sucesso: boolean; motivo: string | null; ip: string | null }[]>`
      select em, email, sucesso, motivo, ip from gov.acesso_log order by id desc limit 40
    `;
    const tabelas = await tx<{ tabela: string }[]>`select distinct tabela from gov.auditoria order by 1`;
    return { registros, acessos, tabelas };
  });

  return (
    <>
      <PageHead titulo="Auditoria" sub="Quem alterou o quê e quando. O voto secreto nunca é registrado aqui." />

      <form method="get" className="filtros">
        <select name="tabela" defaultValue={tabela}>
          <option value="">Todas as tabelas</option>
          {tabelas.map((t) => <option key={t.tabela} value={t.tabela}>{t.tabela}</option>)}
        </select>
        <button className="btn sec" type="submit">Filtrar</button>
      </form>

      <div className="card tabela">
        <h2>Alterações recentes</h2>
        {registros.length === 0 ? <p className="vazio">Nada registrado ainda.</p> : (
          <table>
            <thead><tr><th>Quando</th><th>Quem</th><th>Tabela</th><th>Operação</th><th>Campos</th></tr></thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDataHora(r.em)}</td>
                  <td>{r.autor ?? <span className="muted">sistema</span>}</td>
                  <td>{r.tabela}</td>
                  <td><Chip tom={r.operacao === 'DELETE' ? 'bad' : r.operacao === 'INSERT' ? 'ok' : 'mute'}>{r.operacao}</Chip></td>
                  <td className="muted">{alterados(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card tabela">
        <h2>Últimos acessos</h2>
        <table>
          <thead><tr><th>Quando</th><th>E-mail</th><th>Resultado</th><th>IP</th></tr></thead>
          <tbody>
            {acessos.map((a, i) => (
              <tr key={i}>
                <td>{fmtDataHora(a.em)}</td>
                <td>{a.email}</td>
                <td>{a.sucesso ? <Chip tom="ok">entrou</Chip> : <Chip tom="bad">{a.motivo ?? 'falhou'}</Chip>}</td>
                <td className="muted">{a.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
