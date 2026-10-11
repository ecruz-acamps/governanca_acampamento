import Link from 'next/link';
import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { anoAtual, fmtData, PRESTACAO_STATUS, PRESTACAO_TIPO_LABEL } from '@/lib/format';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { criarPrestacao } from './actions';

type P = { id: string; tipo: string; exercicio: number; periodo_inicio: string; periodo_fim: string; status: string; parecer: string | null };

export default async function PrestacoesPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePerm('financeiro:ler');
  const pode = can(u.papel, 'financeiro:escrever');
  const ano = anoAtual();
  const itens = await run(u.id, (tx) => tx<P[]>`
    select id, tipo, exercicio, periodo_inicio, periodo_fim, status, parecer_cf_resultado as parecer
      from gov.prestacao_contas order by periodo_fim desc limit 200
  `);

  return (
    <>
      <PageHead titulo="Prestação de contas" sub="Balancete anual, prestações mensais e relatório trimestral de verbas públicas, com parecer do Conselho Fiscal (Art. 20 e 22)" />
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      {pode && (
        <form action={criarPrestacao} className="card">
          <h2>Nova prestação</h2>
          <div className="form-grid">
            <Campo label="Tipo">
              <select name="tipo" defaultValue="balancete_anual">
                {Object.entries(PRESTACAO_TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <Campo label="Exercício"><input type="number" name="exercicio" defaultValue={ano} min={2000} max={2100} /></Campo>
            <Campo label="Início do período"><input type="date" name="periodo_inicio" defaultValue={`${ano}-01-01`} required /></Campo>
            <Campo label="Fim do período"><input type="date" name="periodo_fim" defaultValue={`${ano}-12-31`} required /></Campo>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn" type="submit">Criar</button></div>
        </form>
      )}

      <div className="card tabela">
        <h2>Prestações</h2>
        {itens.length === 0 ? <p className="vazio">Nenhuma prestação criada.</p> : (
          <table>
            <thead><tr><th>Tipo</th><th>Período</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {itens.map((p) => {
                const st = PRESTACAO_STATUS[p.status];
                return (
                  <tr key={p.id}>
                    <td>{PRESTACAO_TIPO_LABEL[p.tipo]}<div className="muted">exercício {p.exercicio}</div></td>
                    <td>{fmtData(p.periodo_inicio)} a {fmtData(p.periodo_fim)}</td>
                    <td><Chip tom={st.tom}>{st.rotulo}</Chip>{p.parecer && <> <Chip tom={p.parecer === 'reprovado' ? 'bad' : 'mute'}>parecer: {p.parecer.replaceAll('_', ' ')}</Chip></>}</td>
                    <td><Link href={`/prestacoes/${p.id}`}>Abrir</Link></td>
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
