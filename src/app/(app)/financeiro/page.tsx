import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { anoAtual, fmtData, fmtMoeda, hoje, ORIGEM_LABEL } from '@/lib/format';
import { inteiroOuNulo } from '@/lib/form';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { anexarComprovante, criarLancamento } from './actions';

type L = {
  id: string; data: string; tipo: string; categoria: string | null; descricao: string; valor: string;
  origem: string; convenio: string | null; autorizado_por: string | null; tem_comprovante: boolean; ref: string | null;
};

export default async function FinanceiroPage({ searchParams }: { searchParams: SP & { ano?: string } }) {
  const u = await requirePerm('financeiro:ler');
  const pode = can(u.papel, 'financeiro:escrever');
  const ano = inteiroOuNulo(searchParams.ano ?? null) ?? anoAtual();

  const { linhas, tot, convenios } = await run(u.id, async (tx) => {
    const linhas = await tx<L[]>`
      select l.id, l.data, l.tipo, l.categoria, l.descricao, l.valor::text, l.origem::text, c.origem_nome as convenio,
             l.autorizado_por, (l.comprovante_documento_id is not null) as tem_comprovante,
             replace(d.storage_path, 'fisico:', '') as ref
        from gov.lancamento l
        left join gov.convenio_doacao c on c.id = l.convenio_id
        left join gov.documento d on d.id = l.comprovante_documento_id
       where l.exercicio = ${ano} order by l.data desc, l.criado_em desc limit 500
    `;
    const [tot] = await tx<{ receitas: string; despesas: string; sem_comprovante: number }[]>`
      select coalesce(sum(valor) filter (where tipo = 'receita'), 0)::text as receitas,
             coalesce(sum(valor) filter (where tipo = 'despesa'), 0)::text as despesas,
             count(*) filter (where comprovante_documento_id is null)::int as sem_comprovante
        from gov.lancamento where exercicio = ${ano}
    `;
    const convenios = await tx<{ id: string; origem_nome: string }[]>`
      select id, origem_nome from gov.convenio_doacao where status = 'aceito' order by origem_nome
    `;
    return { linhas, tot, convenios };
  });
  const saldo = Number(tot.receitas) - Number(tot.despesas);

  return (
    <>
      <PageHead titulo="Financeiro" sub={`Exercício ${ano} — toda despesa precisa de autorização (Art. 20, b) e comprovante (Art. 20, a)`}>
        <form method="get" className="acoes">
          <input type="number" name="ano" defaultValue={ano} min={2000} max={2100} style={{ width: 100 }} />
          <button className="btn sec" type="submit">Ver ano</button>
        </form>
      </PageHead>
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      <div className="grid g4" style={{ marginBottom: 18 }}>
        <div className="kpi"><b>{fmtMoeda(tot.receitas)}</b><span>Receitas</span></div>
        <div className="kpi"><b>{fmtMoeda(tot.despesas)}</b><span>Despesas</span></div>
        <div className="kpi"><b style={{ color: saldo < 0 ? 'var(--bad-ink)' : undefined }}>{fmtMoeda(saldo)}</b><span>Saldo do exercício</span></div>
        <div className="kpi"><b style={{ color: tot.sem_comprovante ? 'var(--warn-ink)' : undefined }}>{tot.sem_comprovante}</b><span>Lançamentos sem comprovante</span></div>
      </div>

      {pode && (
        <form action={criarLancamento} className="card">
          <h2>Novo lançamento</h2>
          <div className="form-grid">
            <Campo label="Data"><input type="date" name="data" defaultValue={hoje()} required /></Campo>
            <Campo label="Tipo">
              <select name="tipo" defaultValue="despesa"><option value="despesa">Despesa</option><option value="receita">Receita</option></select>
            </Campo>
            <Campo label="Valor (R$)"><input type="text" name="valor" inputMode="decimal" placeholder="250,00" required /></Campo>
            <Campo label="Categoria"><input type="text" name="categoria" /></Campo>
            <Campo label="Descrição" className="larga"><input type="text" name="descricao" required /></Campo>
            <Campo label="Origem do recurso">
              <select name="origem" defaultValue="propria">
                {Object.entries(ORIGEM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <Campo label="Convênio/doação" dica="Obrigatório para verba pública e convênio (Art. 27 §3)">
              <select name="convenio_id" defaultValue="">
                <option value="">—</option>
                {convenios.map((c) => <option key={c.id} value={c.id}>{c.origem_nome}</option>)}
              </select>
            </Campo>
            <Campo label="Autorizado por (despesa)" dica="Coordenação geral"><input type="text" name="autorizado_por" /></Campo>
            <Campo label="Comprovante (nº da nota / pasta)" dica="Deixe vazio se ainda não tem"><input type="text" name="comprovante_ref" /></Campo>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn" type="submit">Lançar</button></div>
        </form>
      )}

      <div className="card tabela">
        <h2>Lançamentos de {ano}</h2>
        {linhas.length === 0 ? <p className="vazio">Nenhum lançamento neste ano.</p> : (
          <table>
            <thead><tr><th>Data</th><th>Descrição</th><th>Origem</th><th style={{ textAlign: 'right' }}>Valor</th><th>Comprovante</th></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td>{fmtData(l.data)}</td>
                  <td>{l.descricao}<div className="muted">{[l.categoria, l.autorizado_por && `autorizado por ${l.autorizado_por}`].filter(Boolean).join(' · ')}</div></td>
                  <td>{ORIGEM_LABEL[l.origem]}{l.convenio && <div className="muted">{l.convenio}</div>}</td>
                  <td style={{ textAlign: 'right', color: l.tipo === 'despesa' ? 'var(--bad-ink)' : 'var(--ok-ink)' }}>
                    {l.tipo === 'despesa' ? '− ' : '+ '}{fmtMoeda(l.valor)}
                  </td>
                  <td>
                    {l.tem_comprovante ? <Chip tom="ok">{l.ref}</Chip> : pode ? (
                      <form action={anexarComprovante} className="acoes">
                        <input type="hidden" name="id" value={l.id} /><input type="hidden" name="ano" value={ano} />
                        <input type="text" name="comprovante_ref" placeholder="Referência" style={{ width: 130 }} />
                        <button className="btn sec mini" type="submit">Anexar</button>
                      </form>
                    ) : <Chip tom="warn">Pendente</Chip>}
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
