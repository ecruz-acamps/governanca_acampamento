import Link from 'next/link';
import { Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { anoAtual, CARGO_LABEL, fmtData } from '@/lib/format';
import { requirePerm } from '@/lib/session';

const ORIGEM: Record<string, { rotulo: string; href: string }> = {
  obrigacao: { rotulo: 'Obrigação', href: '/calendario' },
  mandato: { rotulo: 'Mandato', href: '/mandatos' },
  disciplinar_recurso: { rotulo: 'Disciplinar', href: '/' },
  disciplinar_assembleia: { rotulo: 'Disciplinar', href: '/' },
  frequencia: { rotulo: 'Frequência', href: '/reunioes' },
  financeiro: { rotulo: 'Financeiro', href: '/' },
};

type Alerta = { origem: string; descricao: string; prazo: string; situacao: string; dias: number };

export default async function Painel({ searchParams }: { searchParams: SP }) {
  const u = await requirePerm('painel:ler');
  const ano = anoAtual();

  const dados = await run(u.id, async (tx) => {
    const [k] = await tx<{ ativos: number; acomp: number; interessados: number; mandatos: number }[]>`
      select count(*) filter (where status = 'associado')::int as ativos,
             count(*) filter (where status = 'em_acompanhamento')::int as acomp,
             count(*) filter (where status = 'interessado')::int as interessados,
             (select count(*) from gov.mandato where situacao = 'ativo')::int as mandatos
        from gov.associado
    `;
    const alertas = await tx<Alerta[]>`
      select origem, descricao, prazo, situacao, (prazo - current_date)::int as dias
        from gov.v_alertas order by prazo limit 40
    `;
    const baixa = await tx<{ nome: string; percentual: string; presencas: number; reunioes_no_periodo: number }[]>`
      select nome, percentual, presencas::int, reunioes_no_periodo::int
        from gov.v_frequencia_anual where ano = ${ano} and abaixo_do_minimo order by percentual
    `;
    const composicao = await tx<{ cargo: string; nome: string; fim: string; dias_para_fim: number }[]>`
      select cargo::text, nome, fim, dias_para_fim::int from gov.v_composicao_atual
       where cargo not in ('fiscal_titular','fiscal_suplente')
    `;
    return { k, alertas, baixa, composicao };
  });

  const vencidas = dados.alertas.filter((a) => a.situacao === 'vencida').length;

  return (
    <>
      <PageHead titulo="Painel" sub={`Situação da associação em ${ano}`} />
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      <div className="grid g4" style={{ marginBottom: 18 }}>
        <div className="kpi"><b>{dados.k.ativos}</b><span>Associados ativos</span></div>
        <div className="kpi"><b>{dados.k.acomp + dados.k.interessados}</b><span>Em acompanhamento / interessados</span></div>
        <div className="kpi"><b>{dados.k.mandatos}</b><span>Mandatos ativos</span></div>
        <div className="kpi"><b style={{ color: vencidas ? 'var(--bad-ink)' : undefined }}>{vencidas}</b><span>Prazos vencidos</span></div>
      </div>

      <div className="card">
        <h2>Alertas e prazos</h2>
        {dados.alertas.length === 0 ? (
          <p className="vazio">Nenhum prazo próximo. Gere as obrigações do ano em “Calendário de obrigações”.</p>
        ) : (
          <div className="tabela">
            <table>
              <thead><tr><th>Situação</th><th>Tipo</th><th>O que</th><th>Prazo</th></tr></thead>
              <tbody>
                {dados.alertas.map((a, i) => {
                  const o = ORIGEM[a.origem] ?? { rotulo: a.origem, href: '/' };
                  return (
                    <tr key={i}>
                      <td>
                        {a.situacao === 'vencida'
                          ? <Chip tom="bad">Vencida</Chip>
                          : <Chip tom="warn">{a.dias === 0 ? 'Hoje' : `em ${a.dias} dia${a.dias === 1 ? '' : 's'}`}</Chip>}
                      </td>
                      <td><Link href={o.href}>{o.rotulo}</Link></td>
                      <td>{a.descricao}</td>
                      <td>{fmtData(a.prazo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid g2">
        <div className="card">
          <h2>Diretoria atual</h2>
          {dados.composicao.length === 0 ? (
            <p className="vazio">Nenhum mandato ativo cadastrado.</p>
          ) : (
            <table>
              <tbody>
                {dados.composicao.map((c) => (
                  <tr key={c.cargo}>
                    <td className="muted">{CARGO_LABEL[c.cargo] ?? c.cargo}</td>
                    <td>{c.nome}</td>
                    <td className="muted">até {fmtData(c.fim)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <h2>Frequência abaixo de 75% ({ano})</h2>
          {dados.baixa.length === 0 ? (
            <p className="vazio">Ninguém abaixo do mínimo (Art. 7, j).</p>
          ) : (
            <table>
              <tbody>
                {dados.baixa.map((b) => (
                  <tr key={b.nome}>
                    <td>{b.nome}</td>
                    <td className="muted">{b.presencas}/{b.reunioes_no_periodo}</td>
                    <td><Chip tom="bad">{b.percentual}%</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
