import Link from 'next/link';
import { Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { anoAtual, fmtData } from '@/lib/format';
import { requireAssociado } from '@/lib/session';

export default async function PortalPage({ searchParams }: { searchParams: SP }) {
  const u = await requireAssociado();
  const ano = anoAtual();
  const d = await run(u.id, async (tx) => {
    const [a] = await tx<{ nome: string; status: string; data_admissao: string | null; data_promessa: string | null }[]>`
      select nome, status::text, data_admissao, data_promessa from gov.associado where id = ${u.associadoId}
    `;
    const [f] = await tx<{ presencas: number; total: number; pct: string; abaixo: boolean }[]>`
      select presencas::int, reunioes_no_periodo::int as total, percentual::text as pct, abaixo_do_minimo as abaixo
        from gov.v_frequencia_anual where associado_id = ${u.associadoId} and ano = ${ano}
    `;
    const votacoes = await tx<{ id: string; ano: number; ja_votei: boolean }[]>`
      select e.id, e.ano,
             exists (select 1 from gov.eleitor_participacao p
                      where p.eleicao_id = e.id and p.rodada = gov.rodada_atual(e.id) and p.associado_id = ${u.associadoId}) as ja_votei
        from gov.eleicao e where e.status = 'votacao'
    `;
    const assembleias = await tx<{ id: string; titulo: string; tipo: string; data_realizacao: string }[]>`
      select id, titulo, tipo::text, data_realizacao from gov.assembleia
       where status = 'convocada' and data_realizacao >= current_date order by data_realizacao limit 5
    `;
    const reunioes = await tx<{ id: string; titulo: string | null; tipo: string; data: string; local: string | null }[]>`
      select id, titulo, tipo::text, data, local from gov.reuniao where data >= current_date order by data limit 5
    `;
    return { a, f, votacoes, assembleias, reunioes };
  });
  if (!d.a) return <p className="vazio">Cadastro de associado não encontrado.</p>;
  const ativo = d.a.status === 'associado';

  return (
    <>
      <PageHead titulo={`Olá, ${d.a.nome.split(' ')[0]}`} sub="Seu espaço de associado">
        <Chip tom={ativo ? 'ok' : 'warn'}>{ativo ? 'associado ativo' : d.a.status.replaceAll('_', ' ')}</Chip>
      </PageHead>
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      {d.votacoes.map((v) => (
        <div className="card" key={v.id}>
          <h3>Eleição {v.ano} — votação aberta</h3>
          {v.ja_votei ? <p>Seu voto já foi registrado. Obrigado!</p> : (
            <><p>Você pode votar agora, em sigilo.</p><Link className="btn" href={`/portal/votar/${v.id}`}>Votar</Link></>
          )}
        </div>
      ))}

      <div className="grid g4" style={{ marginBottom: 18 }}>
        <div className="kpi">
          <b style={{ color: d.f?.abaixo ? 'var(--bad-ink)' : undefined }}>{d.f ? `${d.f.pct}%` : '—'}</b>
          <span>Presença em {ano}{d.f && ` (${d.f.presencas} de ${d.f.total} reuniões)`}</span>
        </div>
        <div className="kpi"><b>{d.a.data_admissao ? fmtData(d.a.data_admissao) : '—'}</b><span>Admissão</span></div>
        <div className="kpi"><b>{d.a.data_promessa ? fmtData(d.a.data_promessa) : '—'}</b><span>Promessa</span></div>
      </div>
      {d.f?.abaixo && <div className="flash erro">Sua presença está abaixo de 75%. Fale com a secretaria se precisar justificar ausências.</div>}

      <div className="grid g2">
        <div className="card">
          <h3>Próximas reuniões</h3>
          {d.reunioes.length === 0 ? <p className="vazio">Nenhuma reunião marcada.</p> : d.reunioes.map((r) => (
            <p key={r.id}><b>{fmtData(r.data)}</b> — {r.titulo ?? r.tipo.replaceAll('_', ' ')}{r.local && <span className="muted"> · {r.local}</span>}</p>
          ))}
        </div>
        <div className="card">
          <h3>Assembleias convocadas</h3>
          {d.assembleias.length === 0 ? <p className="vazio">Nenhuma assembleia convocada.</p> : d.assembleias.map((s) => (
            <p key={s.id}><b>{fmtData(s.data_realizacao)}</b> — {s.tipo} · {s.titulo}</p>
          ))}
        </div>
      </div>

      <div className="acoes">
        <Link className="btn sec" href="/portal/carteirinha">Minha carteirinha</Link>
        <Link className="btn sec" href="/portal/presenca">Minhas presenças</Link>
      </div>
    </>
  );
}
