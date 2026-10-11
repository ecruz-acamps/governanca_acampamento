import Link from 'next/link';
import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { fmtData, MEDIDA_LABEL, MOTIVO_LABEL, STATUS_PROC } from '@/lib/format';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { abrirProcesso } from './actions';

type Lin = { id: string; nome: string; medida: string; motivo: string; status: string; aberto_em: string; prazo_recurso: string | null; prazo_assembleia: string | null };

export default async function DisciplinarPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePerm('disciplinar:ler');
  const podeEscrever = can(u.papel, 'disciplinar:escrever');
  const { linhas, assoc } = await run(u.id, async (tx) => {
    const linhas = await tx<Lin[]>`
      select p.id, a.nome, p.medida::text, p.motivo::text, p.status, p.aberto_em, p.prazo_recurso, p.prazo_assembleia
        from gov.processo_disciplinar p join gov.associado a on a.id = p.associado_id
       order by p.criado_em desc limit 200
    `;
    const assoc = await tx<{ id: string; nome: string }[]>`
      select id, nome from gov.associado where status in ('associado','suspenso') order by nome
    `;
    return { linhas, assoc };
  });

  return (
    <>
      <PageHead titulo="Processos disciplinares" sub="Art. 8: consenso, ampla defesa, recurso em 5 dias, assembleia em 30 dias, sem efeito suspensivo" />
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      {podeEscrever && (
        <form action={abrirProcesso} className="card">
          <h2>Abrir processo</h2>
          <div className="form-grid">
            <Campo label="Associado">
              <select name="associado_id" required defaultValue="">
                <option value="" disabled>Escolha…</option>
                {assoc.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Medida proposta">
              <select name="medida" defaultValue="advertencia">
                {Object.entries(MEDIDA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <Campo label="Motivo" className="larga">
              <select name="motivo" defaultValue="descumprimento_estatuto">
                {Object.entries(MOTIVO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <Campo label="Fatos" className="larga"><textarea name="descricao" required /></Campo>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn" type="submit">Abrir processo</button></div>
        </form>
      )}

      <div className="card tabela">
        <h2>Processos</h2>
        {linhas.length === 0 ? <p className="vazio">Nenhum processo aberto.</p> : (
          <table>
            <thead><tr><th>Associado</th><th>Medida</th><th>Situação</th><th>Prazo</th><th></th></tr></thead>
            <tbody>
              {linhas.map((p) => {
                const st = STATUS_PROC[p.status];
                const prazo = p.status === 'aplicada' ? p.prazo_recurso : p.status === 'em_recurso' ? p.prazo_assembleia : null;
                return (
                  <tr key={p.id}>
                    <td>{p.nome}<div className="muted">aberto em {fmtData(p.aberto_em)}</div></td>
                    <td>{MEDIDA_LABEL[p.medida]}<div className="muted">{MOTIVO_LABEL[p.motivo]}</div></td>
                    <td><Chip tom={st.tom}>{st.rotulo}</Chip></td>
                    <td>{prazo ? fmtData(prazo) : <span className="muted">—</span>}</td>
                    <td><Link href={`/disciplinar/${p.id}`}>Abrir</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
