import Link from 'next/link';
import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { anoAtual, ELEICAO_STATUS, fmtData } from '@/lib/format';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { criarEleicao } from './actions';

type E = { id: string; ano: number; data_eleicao: string; status: string; candidatos: number };

export default async function EleicoesPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePerm('eleicoes:ler');
  const pode = can(u.papel, 'eleicoes:escrever');
  const ano = anoAtual();
  const itens = await run(u.id, (tx) => tx<E[]>`
    select e.id, e.ano, e.data_eleicao, e.status, (select count(*)::int from gov.candidatura c where c.eleicao_id = e.id) as candidatos
      from gov.eleicao e order by e.data_eleicao desc
  `);

  return (
    <>
      <PageHead titulo="Eleições" sub="Diretoria e Conselho Fiscal. Eleição até 30 de novembro (Art. 28); candidatos indicados até 1 mês antes e apresentados à secretaria até 15 dias antes (Art. 29); voto secreto concordo/discordo (Art. 30)" />
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      {pode && (
        <form action={criarEleicao} className="card">
          <h2>Nova eleição</h2>
          <div className="form-grid">
            <Campo label="Ano"><input type="number" name="ano" defaultValue={ano} min={2000} max={2100} /></Campo>
            <Campo label="Data da eleição" dica="No máximo 30/11 do ano"><input type="date" name="data_eleicao" required /></Campo>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn" type="submit">Criar</button></div>
        </form>
      )}

      <div className="card tabela">
        <h2>Eleições</h2>
        {itens.length === 0 ? <p className="vazio">Nenhuma eleição cadastrada.</p> : (
          <table>
            <thead><tr><th>Ano</th><th>Data</th><th>Situação</th><th>Candidaturas</th><th></th></tr></thead>
            <tbody>
              {itens.map((e) => {
                const st = ELEICAO_STATUS[e.status];
                return (
                  <tr key={e.id}>
                    <td>{e.ano}</td><td>{fmtData(e.data_eleicao)}</td>
                    <td><Chip tom={st.tom}>{st.rotulo}</Chip></td><td>{e.candidatos}</td>
                    <td><Link href={`/eleicoes/${e.id}`}>Abrir</Link></td>
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
