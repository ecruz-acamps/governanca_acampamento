import Link from 'next/link';
import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { ASSEMBLEIA_STATUS, CANAIS, CONVOCADA_POR_LABEL, fmtData } from '@/lib/format';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { criarAssembleia } from './actions';

type Lin = {
  id: string; tipo: string; titulo: string; data_convocacao: string; data_realizacao: string;
  status: string; presentes: number | null; associados_aptos: number | null; convocacao_numero: number;
};

export default async function AssembleiasPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePerm('assembleias:ler');
  const podeEscrever = can(u.papel, 'assembleias:escrever');
  const linhas = await run(u.id, (tx) => tx<Lin[]>`
    select id, tipo::text, titulo, data_convocacao, data_realizacao, status, presentes, associados_aptos, convocacao_numero
      from gov.assembleia order by data_realizacao desc limit 200
  `);

  return (
    <>
      <PageHead titulo="Assembleias" sub="Convocação com 30 dias de antecedência (Art. 13), quórum e deliberações" />
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      {podeEscrever && (
        <form action={criarAssembleia} className="card">
          <h2>Convocar assembleia</h2>
          <div className="form-grid">
            <Campo label="Tipo">
              <select name="tipo" defaultValue="AGO">
                <option value="AGO">AGO — Ordinária</option>
                <option value="AGE">AGE — Extraordinária</option>
              </select>
            </Campo>
            <Campo label="Convocada por">
              <select name="convocada_por" defaultValue="presidente">
                {Object.entries(CONVOCADA_POR_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <Campo label="Convocação nº" dica="1ª, 2ª ou 3ª (muda o quórum)">
              <select name="convocacao_numero" defaultValue="1">
                <option value="1">1ª convocação</option>
                <option value="2">2ª convocação</option>
                <option value="3">3ª convocação</option>
              </select>
            </Campo>
            <Campo label="Título" className="larga"><input type="text" name="titulo" required /></Campo>
            <Campo label="Data da convocação"><input type="date" name="data_convocacao" required /></Campo>
            <Campo label="Data de realização" dica="Mínimo de 30 dias depois da convocação"><input type="date" name="data_realizacao" required /></Campo>
            <div className="larga acoes">
              <span className="muted">Divulgada em:</span>
              {CANAIS.map((c) => (
                <label key={c} className="check"><input type="checkbox" name="canais" value={c} defaultChecked /> {c}</label>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn" type="submit">Convocar</button></div>
        </form>
      )}

      <div className="card tabela">
        <h2>Assembleias</h2>
        {linhas.length === 0 ? <p className="vazio">Nenhuma assembleia cadastrada.</p> : (
          <table>
            <thead><tr><th>Realização</th><th>Assembleia</th><th>Status</th><th>Presentes</th><th></th></tr></thead>
            <tbody>
              {linhas.map((a) => {
                const st = ASSEMBLEIA_STATUS[a.status];
                return (
                  <tr key={a.id}>
                    <td>{fmtData(a.data_realizacao)}<div className="muted">convocada {fmtData(a.data_convocacao)}</div></td>
                    <td>{a.titulo}<div className="muted">{a.tipo} · {a.convocacao_numero}ª convocação</div></td>
                    <td><Chip tom={st.tom}>{st.rotulo}</Chip></td>
                    <td>{a.presentes ?? '—'}{a.associados_aptos != null && <span className="muted"> / {a.associados_aptos} aptos</span>}</td>
                    <td><Link href={`/assembleias/${a.id}`}>Abrir</Link></td>
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
