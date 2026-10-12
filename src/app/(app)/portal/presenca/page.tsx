import { Chip, PageHead } from '@/components/ui';
import { run } from '@/lib/db';
import { fmtData } from '@/lib/format';
import { requireAssociado } from '@/lib/session';

type R = { id: string; data: string; titulo: string | null; tipo: string; presente: boolean | null; justificativa: string | null };

export default async function PresencaPage() {
  const u = await requireAssociado();
  const { reunioes, assembleias } = await run(u.id, async (tx) => {
    const reunioes = await tx<R[]>`
      select r.id, r.data, r.titulo, r.tipo::text, p.presente, p.justificativa
        from gov.associado a
        join gov.reuniao r on r.conta_presenca and a.data_admissao is not null and r.data >= a.data_admissao and r.data <= current_date
        left join gov.presenca p on p.reuniao_id = r.id and p.associado_id = a.id
       where a.id = ${u.associadoId} order by r.data desc limit 100
    `;
    const assembleias = await tx<{ id: string; titulo: string; tipo: string; data_realizacao: string; modalidade: string | null }[]>`
      select s.id, s.titulo, s.tipo::text, s.data_realizacao, ap.modalidade
        from gov.assembleia s left join gov.assembleia_presenca ap on ap.assembleia_id = s.id and ap.associado_id = ${u.associadoId}
       where s.status in ('instalada','realizada') order by s.data_realizacao desc limit 30
    `;
    return { reunioes, assembleias };
  });
  const presentes = reunioes.filter((r) => r.presente).length;

  return (
    <>
      <PageHead titulo="Minhas presenças" sub="Reuniões que contam para o mínimo de 75% e assembleias" />
      <div className="card tabela">
        <h2>Reuniões <span className="muted" style={{ fontSize: 14 }}>({presentes} presenças em {reunioes.length})</span></h2>
        {reunioes.length === 0 ? <p className="vazio">Nenhuma reunião registrada.</p> : (
          <table>
            <thead><tr><th>Data</th><th>Reunião</th><th>Situação</th></tr></thead>
            <tbody>
              {reunioes.map((r) => (
                <tr key={r.id}>
                  <td>{fmtData(r.data)}</td><td>{r.titulo ?? r.tipo.replaceAll('_', ' ')}</td>
                  <td>
                    {r.presente ? <Chip tom="ok">presente</Chip> : <Chip tom="bad">ausente</Chip>}
                    {r.justificativa && <span className="muted"> {r.justificativa}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="card tabela">
        <h2>Assembleias</h2>
        {assembleias.length === 0 ? <p className="vazio">Nenhuma assembleia realizada.</p> : (
          <table>
            <thead><tr><th>Data</th><th>Assembleia</th><th>Situação</th></tr></thead>
            <tbody>
              {assembleias.map((s) => (
                <tr key={s.id}>
                  <td>{fmtData(s.data_realizacao)}</td><td>{s.tipo} · {s.titulo}</td>
                  <td>{s.modalidade ? <Chip tom="ok">{s.modalidade}</Chip> : <Chip tom="mute">sem registro</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
