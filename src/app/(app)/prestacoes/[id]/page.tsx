import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { fmtData, fmtMoeda, hoje, ORIGEM_LABEL, PRESTACAO_STATUS, PRESTACAO_TIPO_LABEL } from '@/lib/format';
import { isUuid } from '@/lib/form';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { aprovarEmAssembleia, emitirPrestacao, registrarParecer } from '../actions';

type P = {
  id: string; tipo: string; exercicio: number; periodo_inicio: string; periodo_fim: string; status: string;
  parecer_cf_em: string | null; parecer_cf_resultado: string | null; parecer_cf_texto: string | null;
  assembleia_titulo: string | null;
};

export default async function PrestacaoPage({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const u = await requirePerm('financeiro:ler');
  if (!isUuid(params.id)) notFound();
  const podeFin = can(u.papel, 'financeiro:escrever');
  const podeParecer = can(u.papel, 'parecer:escrever');

  const r = await run(u.id, async (tx) => {
    const [p] = await tx<P[]>`
      select p.id, p.tipo, p.exercicio, p.periodo_inicio, p.periodo_fim, p.status, p.parecer_cf_em, p.parecer_cf_resultado,
             p.parecer_cf_texto, s.titulo as assembleia_titulo
        from gov.prestacao_contas p left join gov.assembleia s on s.id = p.apresentado_assembleia_id
       where p.id = ${params.id}
    `;
    if (!p) return null;
    const porOrigem = await tx<{ origem: string; tipo: string; total: string; qtd: number; sem_comp: number }[]>`
      select origem::text, tipo, sum(valor)::text as total, count(*)::int as qtd,
             count(*) filter (where comprovante_documento_id is null)::int as sem_comp
        from gov.lancamento
       where data between ${p.periodo_inicio} and ${p.periodo_fim}
         ${p.tipo === 'trimestral_verba_publica' ? tx`and origem in ('verba_publica','convenio')` : tx``}
       group by origem, tipo order by tipo, origem
    `;
    const assembleias = await tx<{ id: string; titulo: string; data_realizacao: string }[]>`
      select id, titulo, data_realizacao from gov.assembleia where status in ('instalada','realizada') order by data_realizacao desc limit 50
    `;
    return { p, porOrigem, assembleias };
  });
  if (!r) notFound();
  const { p, porOrigem, assembleias } = r;
  const st = PRESTACAO_STATUS[p.status];
  const rec = porOrigem.filter((x) => x.tipo === 'receita').reduce((a, x) => a + Number(x.total), 0);
  const desp = porOrigem.filter((x) => x.tipo === 'despesa').reduce((a, x) => a + Number(x.total), 0);
  const semComp = porOrigem.reduce((a, x) => a + x.sem_comp, 0);

  return (
    <>
      <PageHead titulo={PRESTACAO_TIPO_LABEL[p.tipo]} sub={`${fmtData(p.periodo_inicio)} a ${fmtData(p.periodo_fim)} · exercício ${p.exercicio}`}>
        <Chip tom={st.tom}>{st.rotulo}</Chip>
        <Link className="btn sec" href="/prestacoes">Voltar</Link>
      </PageHead>
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      <div className="grid g4" style={{ marginBottom: 18 }}>
        <div className="kpi"><b>{fmtMoeda(rec)}</b><span>Receitas no período</span></div>
        <div className="kpi"><b>{fmtMoeda(desp)}</b><span>Despesas no período</span></div>
        <div className="kpi"><b>{fmtMoeda(rec - desp)}</b><span>Resultado</span></div>
        <div className="kpi"><b style={{ color: semComp ? 'var(--warn-ink)' : undefined }}>{semComp}</b><span>Lançamentos sem comprovante</span></div>
      </div>

      <div className="card tabela">
        <h2>Resumo por origem</h2>
        {porOrigem.length === 0 ? <p className="vazio">Sem lançamentos neste período.</p> : (
          <table>
            <thead><tr><th>Tipo</th><th>Origem</th><th>Lançamentos</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>
              {porOrigem.map((x) => (
                <tr key={x.tipo + x.origem}>
                  <td>{x.tipo === 'receita' ? 'Receita' : 'Despesa'}</td><td>{ORIGEM_LABEL[x.origem]}</td>
                  <td>{x.qtd}{x.sem_comp > 0 && <span className="muted"> ({x.sem_comp} sem comprovante)</span>}</td>
                  <td style={{ textAlign: 'right' }}>{fmtMoeda(x.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {semComp > 0 && <p className="muted" style={{ marginTop: 10 }}>Regularize os comprovantes em Financeiro antes de emitir (Art. 20, a).</p>}
      </div>

      {podeFin && p.status === 'rascunho' && (
        <form action={emitirPrestacao} className="card">
          <input type="hidden" name="id" value={p.id} />
          <h3>1. Emitir</h3>
          <p className="muted">Depois de emitida, vai ao Conselho Fiscal para parecer.</p>
          <button className="btn" type="submit">Emitir prestação</button>
        </form>
      )}

      {p.parecer_cf_resultado && (
        <div className="card">
          <h3>Parecer do Conselho Fiscal</h3>
          <Chip tom={p.parecer_cf_resultado === 'reprovado' ? 'bad' : 'ok'}>{p.parecer_cf_resultado.replaceAll('_', ' ')}</Chip>
          <span className="muted"> em {fmtData(p.parecer_cf_em)}</span>
          {p.parecer_cf_texto && <p style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{p.parecer_cf_texto}</p>}
        </div>
      )}

      {podeParecer && ['emitido', 'com_parecer_cf'].includes(p.status) && (
        <form action={registrarParecer} className="card">
          <h3>2. Parecer do Conselho Fiscal (Art. 22)</h3>
          <input type="hidden" name="id" value={p.id} />
          <div className="form-grid">
            <Campo label="Resultado">
              <select name="resultado" defaultValue="aprovado">
                <option value="aprovado">Aprovado</option>
                <option value="aprovado_com_ressalvas">Aprovado com ressalvas</option>
                <option value="reprovado">Reprovado</option>
              </select>
            </Campo>
            <Campo label="Data"><input type="date" name="data" defaultValue={hoje()} /></Campo>
            <Campo label="Parecer" className="larga"><textarea name="texto" /></Campo>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn" type="submit">Registrar parecer</button></div>
        </form>
      )}

      {p.assembleia_titulo && (
        <div className="card"><h3>Aprovada em assembleia</h3><p>{p.assembleia_titulo}</p></div>
      )}

      {podeFin && p.status === 'com_parecer_cf' && (
        <form action={aprovarEmAssembleia} className="card">
          <h3>3. Aprovação em assembleia (Art. 11, I)</h3>
          <input type="hidden" name="id" value={p.id} />
          <div className="acoes">
            <select name="assembleia_id" required defaultValue="" style={{ maxWidth: 420 }}>
              <option value="" disabled>Escolha a assembleia…</option>
              {assembleias.map((a) => <option key={a.id} value={a.id}>{fmtData(a.data_realizacao)} — {a.titulo}</option>)}
            </select>
            <button className="btn" type="submit">Marcar como aprovada</button>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>Para o balancete anual, a assembleia precisa ter uma deliberação aprovada de “Contas anuais”.</p>
        </form>
      )}
    </>
  );
}
