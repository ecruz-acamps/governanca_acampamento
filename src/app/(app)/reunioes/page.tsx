import Link from 'next/link';
import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { anoAtual, fmtData, hoje, REUNIAO_LABEL } from '@/lib/format';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { criarReuniao } from './actions';

export default async function ReunioesPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePerm('reunioes:ler');
  const ano = anoAtual();
  const podeEscrever = can(u.papel, 'reunioes:escrever');

  const { reunioes, freq } = await run(u.id, async (tx) => {
    const reunioes = await tx<{
      id: string; tipo: string; data: string; titulo: string | null; conta_presenca: boolean;
      presentes: number; registrados: number;
    }[]>`
      select r.id, r.tipo::text, r.data, r.titulo, r.conta_presenca,
             count(p.*) filter (where p.presente)::int as presentes,
             count(p.*)::int as registrados
        from gov.reuniao r left join gov.presenca p on p.reuniao_id = r.id
       where extract(year from r.data) = ${ano}
       group by r.id order by r.data desc
    `;
    const freq = await tx<{ nome: string; presencas: number; reunioes_no_periodo: number; percentual: string; abaixo_do_minimo: boolean }[]>`
      select nome, presencas::int, reunioes_no_periodo::int, percentual::text, abaixo_do_minimo
        from gov.v_frequencia_anual where ano = ${ano} order by nome
    `;
    return { reunioes, freq };
  });

  return (
    <>
      <PageHead titulo="Reuniões e presença" sub={`${ano} — o mínimo é 75% de presença nas reuniões (Art. 7, j)`} />
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      {podeEscrever && (
        <form action={criarReuniao} className="card">
          <h2>Nova reunião</h2>
          <div className="form-grid">
            <Campo label="Tipo">
              <select name="tipo" required defaultValue="mensal">
                {Object.entries(REUNIAO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <Campo label="Data"><input type="date" name="data" defaultValue={hoje()} required /></Campo>
            <Campo label="Título (opcional)"><input type="text" name="titulo" /></Campo>
            <Campo label="Local"><input type="text" name="local" /></Campo>
            <Campo label="Pauta" className="larga"><textarea name="pauta" /></Campo>
            <label className="check larga">
              <input type="checkbox" name="conta_presenca" defaultChecked /> Conta para os 75% de presença
            </label>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn" type="submit">Criar e marcar presença</button></div>
        </form>
      )}

      <div className="card tabela">
        <h2>Reuniões de {ano}</h2>
        {reunioes.length === 0 ? <p className="vazio">Nenhuma reunião cadastrada neste ano.</p> : (
          <table>
            <thead><tr><th>Data</th><th>Tipo</th><th>Título</th><th>Presentes</th><th></th></tr></thead>
            <tbody>
              {reunioes.map((r) => (
                <tr key={r.id}>
                  <td>{fmtData(r.data)}</td>
                  <td>{REUNIAO_LABEL[r.tipo]}</td>
                  <td>{r.titulo ?? <span className="muted">—</span>}</td>
                  <td>{r.registrados === 0 ? <Chip tom="warn">sem registro</Chip> : `${r.presentes}/${r.registrados}`}
                    {!r.conta_presenca && <> <Chip>não conta</Chip></>}</td>
                  <td><Link href={`/reunioes/${r.id}`}>Abrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card tabela">
        <h2>Frequência dos associados em {ano}</h2>
        {freq.length === 0 ? <p className="vazio">Ainda não há presenças contadas.</p> : (
          <table>
            <thead><tr><th>Associado</th><th>Presenças</th><th>Frequência</th></tr></thead>
            <tbody>
              {freq.map((f) => (
                <tr key={f.nome}>
                  <td>{f.nome}</td>
                  <td className="muted">{f.presencas}/{f.reunioes_no_periodo}</td>
                  <td><Chip tom={f.abaixo_do_minimo ? 'bad' : 'ok'}>{f.percentual}%</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
