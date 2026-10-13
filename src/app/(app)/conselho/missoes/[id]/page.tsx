import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { isUuid } from '@/lib/form';
import { fmtData, hoje, MISSAO_STATUS } from '@/lib/format';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { adicionarEquipe, aprovarCoordenador, aprovarEquipe, definirCoordenador, mudarStatusMissao, removerEquipe } from '../../actions';

const FUNCAO: Record<string, string> = { pregador: 'Pregador', coordenador_setor: 'Coordenador de setor', equipe: 'Equipe de trabalho' };
type M = { id: string; nome: string; data_inicio: string | null; data_fim: string | null; status: string; coordenador_id: string | null; coord: string | null; aprovado: string | null };
type E = { associado_id: string; nome: string; funcao: string; aprovado_em: string | null };

export default async function MissaoPage({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const u = await requirePerm('conselho:ler');
  if (!isUuid(params.id)) notFound();
  const podeEscrever = can(u.papel, 'conselho:escrever');
  const r = await run(u.id, async (tx) => {
    const [m] = await tx<M[]>`
      select m.id, m.nome, m.data_inicio, m.data_fim, m.status, m.coordenador_id, a.nome as coord, m.coordenador_aprovado_em as aprovado
        from gov.missao m left join gov.associado a on a.id = m.coordenador_id where m.id = ${params.id}`;
    if (!m) return null;
    const equipe = await tx<E[]>`
      select e.associado_id, a.nome, e.funcao, e.aprovado_em from gov.missao_equipe e
        join gov.associado a on a.id = e.associado_id where e.missao_id = ${params.id} order by e.funcao, a.nome`;
    const assoc = await tx<{ id: string; nome: string }[]>`select id, nome from gov.associado where status = 'associado' order by nome`;
    return { m, equipe, assoc };
  });
  if (!r) notFound();
  const { m, equipe, assoc } = r;
  const st = MISSAO_STATUS[m.status];

  return (
    <>
      <PageHead titulo={m.nome} sub={`${m.data_inicio ? fmtData(m.data_inicio) : 'sem data'}${m.data_fim ? ' a ' + fmtData(m.data_fim) : ''}`}>
        <Chip tom={st.tom}>{st.rotulo}</Chip>
        <Link className="btn sec" href="/conselho">Voltar</Link>
      </PageHead>
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      <div className="card">
        <h2>Coordenador (Art. 26 d)</h2>
        <p>
          {m.coord ?? 'Nenhum indicado'}{' '}
          {m.coord && (m.aprovado ? <Chip tom="ok">aprovado pelo Conselho Geral em {fmtData(m.aprovado)}</Chip> : <Chip tom="warn">aguarda aprovação do Conselho Geral</Chip>)}
        </p>
        {podeEscrever && (
          <>
            <form action={definirCoordenador} className="acoes">
              <input type="hidden" name="id" value={m.id} />
              <select name="coordenador_id" required defaultValue={m.coordenador_id ?? ''}>
                <option value="" disabled>Escolha…</option>
                {assoc.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
              <button className="btn sec" type="submit">{m.coord ? 'Trocar coordenador' : 'Indicar coordenador'}</button>
            </form>
            {m.coord && !m.aprovado && (
              <form action={aprovarCoordenador} className="acoes" style={{ marginTop: 10 }}>
                <input type="hidden" name="id" value={m.id} />
                <Campo label="Data da aprovação pelo Conselho Geral"><input type="date" name="data" defaultValue={hoje()} required /></Campo>
                <button className="btn" type="submit">Registrar aprovação</button>
              </form>
            )}
            <form action={mudarStatusMissao} className="acoes" style={{ marginTop: 10 }}>
              <input type="hidden" name="id" value={m.id} />
              <select name="status" defaultValue={m.status}>
                {Object.entries(MISSAO_STATUS).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
              </select>
              <button className="btn sec" type="submit">Mudar situação</button>
              <span className="muted">Só inicia com coordenador aprovado.</span>
            </form>
          </>
        )}
      </div>

      <div className="card tabela">
        <h2>Pregadores e equipe (Art. 25)</h2>
        {equipe.length === 0 ? <p className="vazio">Ninguém na equipe ainda.</p> : (
          <table>
            <thead><tr><th>Nome</th><th>Função</th><th>Aprovação da coordenação</th>{podeEscrever && <th />}</tr></thead>
            <tbody>
              {equipe.map((e) => (
                <tr key={e.associado_id + e.funcao}>
                  <td>{e.nome}</td><td>{FUNCAO[e.funcao]}</td>
                  <td>{e.aprovado_em ? <Chip tom="ok">{fmtData(e.aprovado_em)}</Chip> : <Chip tom="warn">pendente</Chip>}</td>
                  {podeEscrever && (
                    <td className="acoes">
                      {!e.aprovado_em && (
                        <form action={aprovarEquipe}>
                          <input type="hidden" name="id" value={m.id} /><input type="hidden" name="associado_id" value={e.associado_id} /><input type="hidden" name="funcao" value={e.funcao} />
                          <button className="btn mini" type="submit">Aprovar</button>
                        </form>
                      )}
                      <form action={removerEquipe}>
                        <input type="hidden" name="id" value={m.id} /><input type="hidden" name="associado_id" value={e.associado_id} /><input type="hidden" name="funcao" value={e.funcao} />
                        <button className="btn perigo mini" type="submit">Remover</button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {podeEscrever && (
          <form action={adicionarEquipe} style={{ marginTop: 16 }}>
            <input type="hidden" name="id" value={m.id} />
            <div className="form-grid">
              <Campo label="Associado">
                <select name="associado_id" required defaultValue="">
                  <option value="" disabled>Escolha…</option>
                  {assoc.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </Campo>
              <Campo label="Função">
                <select name="funcao" defaultValue="equipe">
                  {Object.entries(FUNCAO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
            </div>
            <div style={{ marginTop: 14 }}><button className="btn" type="submit">Adicionar</button></div>
          </form>
        )}
      </div>
    </>
  );
}
