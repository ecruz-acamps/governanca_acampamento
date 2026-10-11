import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { fmtData, fmtMoeda, hoje, ORIGEM_LABEL } from '@/lib/format';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { baixarBem, criarBem } from './actions';

type B = {
  id: string; numero_tombo: string | null; descricao: string; categoria: string | null; data_aquisicao: string | null;
  valor: string | null; local: string | null; responsavel: string | null; situacao: string; baixa_em: string | null; inalienavel: boolean;
};

export default async function PatrimonioPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePerm('patrimonio:ler');
  const pode = can(u.papel, 'patrimonio:escrever');
  const { bens, assoc, convenios, delibs } = await run(u.id, async (tx) => {
    const bens = await tx<B[]>`
      select p.id, p.numero_tombo, p.descricao, p.categoria, p.data_aquisicao, p.valor::text, p.local, a.nome as responsavel,
             p.situacao, p.baixa_em, p.inalienavel
        from gov.patrimonio p left join gov.associado a on a.id = p.responsavel_id
       order by p.situacao, p.numero_tombo nulls last, p.descricao
    `;
    const assoc = await tx<{ id: string; nome: string }[]>`select id, nome from gov.associado where status in ('associado','suspenso') order by nome`;
    const convenios = await tx<{ id: string; titulo: string }[]>`select id, origem_nome as titulo from gov.convenio_doacao where status = 'aceito' order by 2`;
    const delibs = await tx<{ id: string; descricao: string; data: string }[]>`
      select d.id, coalesce(d.descricao, 'Alienação de bem') as descricao, s.data_realizacao as data
        from gov.deliberacao d join gov.assembleia s on s.id = d.assembleia_id
       where d.materia = 'alienacao_bem' and d.resultado = 'aprovada' order by s.data_realizacao desc
    `;
    return { bens, assoc, convenios, delibs };
  });
  const ativos = bens.filter((b) => b.situacao === 'ativo');
  const total = ativos.reduce((a, b) => a + Number(b.valor ?? 0), 0);

  return (
    <>
      <PageHead titulo="Patrimônio" sub="Inventário dos bens permanentes. Bens são inalienáveis; a baixa exige assembleia e parecer do Conselho Fiscal (Art. 5, parágrafo único; Art. 12, I; Art. 22, d)" />
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      <div className="grid g4" style={{ marginBottom: 18 }}>
        <div className="kpi"><b>{ativos.length}</b><span>Bens ativos</span></div>
        <div className="kpi"><b>{fmtMoeda(total)}</b><span>Valor registrado</span></div>
        <div className="kpi"><b>{bens.length - ativos.length}</b><span>Bens baixados</span></div>
      </div>

      {pode && (
        <form action={criarBem} className="card">
          <h2>Cadastrar bem</h2>
          <div className="form-grid">
            <Campo label="Descrição" className="larga"><input type="text" name="descricao" required /></Campo>
            <Campo label="Nº de tombo"><input type="text" name="numero_tombo" /></Campo>
            <Campo label="Categoria"><input type="text" name="categoria" /></Campo>
            <Campo label="Data de aquisição"><input type="date" name="data_aquisicao" /></Campo>
            <Campo label="Valor (R$)"><input type="text" name="valor" inputMode="decimal" /></Campo>
            <Campo label="Origem do recurso">
              <select name="origem" defaultValue="">
                <option value="">—</option>
                {Object.entries(ORIGEM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <Campo label="Convênio/doação">
              <select name="convenio_id" defaultValue="">
                <option value="">—</option>
                {convenios.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
              </select>
            </Campo>
            <Campo label="Local"><input type="text" name="local" /></Campo>
            <Campo label="Responsável">
              <select name="responsavel_id" defaultValue="">
                <option value="">—</option>
                {assoc.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </Campo>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn" type="submit">Cadastrar</button></div>
        </form>
      )}

      <div className="card tabela">
        <h2>Inventário</h2>
        {bens.length === 0 ? <p className="vazio">Nenhum bem cadastrado.</p> : (
          <table>
            <thead><tr><th>Tombo</th><th>Bem</th><th>Local / responsável</th><th>Valor</th><th>Situação</th></tr></thead>
            <tbody>
              {bens.map((b) => (
                <tr key={b.id}>
                  <td>{b.numero_tombo ?? '—'}</td>
                  <td>{b.descricao}<div className="muted">{b.categoria}{b.data_aquisicao && ` · adquirido em ${fmtData(b.data_aquisicao)}`}</div></td>
                  <td>{b.local ?? '—'}<div className="muted">{b.responsavel}</div></td>
                  <td>{b.valor ? fmtMoeda(b.valor) : '—'}</td>
                  <td>
                    {b.situacao === 'baixado' ? <Chip tom="bad">baixado em {fmtData(b.baixa_em)}</Chip> : <Chip tom="ok">ativo</Chip>}
                    {pode && b.situacao === 'ativo' && (
                      <details style={{ marginTop: 8 }}>
                        <summary className="muted">Dar baixa…</summary>
                        <form action={baixarBem} style={{ display: 'grid', gap: 8, marginTop: 8, minWidth: 260 }}>
                          <input type="hidden" name="id" value={b.id} />
                          <select name="deliberacao_id" required defaultValue="">
                            <option value="" disabled>Deliberação aprovada…</option>
                            {delibs.map((d) => <option key={d.id} value={d.id}>{fmtData(d.data)} — {d.descricao}</option>)}
                          </select>
                          <label className="campo">Parecer do Conselho Fiscal<input type="date" name="parecer_cf_em" required /></label>
                          <label className="campo">Data da baixa<input type="date" name="baixa_em" defaultValue={hoje()} required /></label>
                          <button className="btn perigo mini" type="submit">Registrar baixa</button>
                        </form>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
