import Link from 'next/link';
import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { fmtData, hoje, MISSAO_STATUS } from '@/lib/format';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { criarMissao, designarMembro, encerrarMembro } from './actions';

type Membro = { id: string; nome: string; area_pastoral: string | null; designado_em: string };
type Missao = { id: string; nome: string; data_inicio: string | null; data_fim: string | null; status: string; coord: string | null; aprovado: string | null };

export default async function ConselhoPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePerm('conselho:ler');
  const podeEscrever = can(u.papel, 'conselho:escrever');

  const { membros, missoes, candidatos } = await run(u.id, async (tx) => {
    const membros = await tx<Membro[]>`
      select m.id, a.nome, m.area_pastoral, m.designado_em
        from gov.conselho_geral_membro m join gov.associado a on a.id = m.associado_id
       where m.encerrado_em is null order by a.nome`;
    const missoes = await tx<Missao[]>`
      select m.id, m.nome, m.data_inicio, m.data_fim, m.status, coalesce(a.nome, m.coordenador_nome) as coord, m.coordenador_aprovado_em as aprovado
        from gov.missao m left join gov.associado a on a.id = m.coordenador_id
       order by coalesce(m.data_inicio, m.criado_em::date) desc`;
    const candidatos = await tx<{ id: string; nome: string }[]>`
      select id, nome from gov.associado where status = 'associado'
         and id not in (select associado_id from gov.conselho_geral_membro where encerrado_em is null)
       order by nome`;
    return { membros, missoes, candidatos };
  });

  return (
    <>
      <PageHead titulo="Conselho Geral e missões" sub="Art. 25 e 26 do estatuto" />
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      <div className="card">
        <h2>Conselho Geral ({membros.length})</h2>
        <p className="muted">Integrantes designados pelo Orientador Espiritual entre os associados. Reúne-se ordinariamente uma vez por ano e extraordinariamente quando necessário.</p>
        {membros.length === 0 ? <p className="vazio">Nenhum membro designado.</p> : (
          <table>
            <thead><tr><th>Membro</th><th>Área pastoral</th><th>Designado em</th>{podeEscrever && <th />}</tr></thead>
            <tbody>
              {membros.map((m) => (
                <tr key={m.id}>
                  <td>{m.nome}</td><td>{m.area_pastoral ?? '—'}</td><td>{fmtData(m.designado_em)}</td>
                  {podeEscrever && (
                    <td><form action={encerrarMembro}><input type="hidden" name="id" value={m.id} />
                      <button className="btn perigo mini" type="submit">Encerrar</button></form></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {podeEscrever && (
          <form action={designarMembro} style={{ marginTop: 16 }}>
            <div className="form-grid">
              <Campo label="Associado">
                <select name="associado_id" required defaultValue="">
                  <option value="" disabled>Escolha…</option>
                  {candidatos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Campo>
              <Campo label="Área pastoral que representa"><input type="text" name="area_pastoral" /></Campo>
              <Campo label="Designado em"><input type="date" name="designado_em" defaultValue={hoje()} required /></Campo>
            </div>
            <div style={{ marginTop: 14 }}><button className="btn" type="submit">Designar membro</button></div>
          </form>
        )}
      </div>

      <div className="card tabela">
        <h2>Missões</h2>
        {missoes.length === 0 ? <p className="vazio">Nenhuma missão cadastrada.</p> : (
          <table>
            <thead><tr><th>Missão</th><th>Período</th><th>Coordenador</th><th>Situação</th></tr></thead>
            <tbody>
              {missoes.map((m) => (
                <tr key={m.id}>
                  <td><Link href={`/conselho/missoes/${m.id}`}>{m.nome}</Link></td>
                  <td>{m.data_inicio ? fmtData(m.data_inicio) : '—'}{m.data_fim ? ` a ${fmtData(m.data_fim)}` : ''}</td>
                  <td>{m.coord ?? '—'} {m.coord && (m.aprovado ? <Chip tom="ok">aprovado</Chip> : <Chip tom="warn">aguarda Conselho</Chip>)}</td>
                  <td><Chip tom={MISSAO_STATUS[m.status].tom}>{MISSAO_STATUS[m.status].rotulo}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {podeEscrever && (
          <form action={criarMissao} style={{ marginTop: 16 }}>
            <div className="form-grid">
              <Campo label="Nome da missão" className="larga"><input type="text" name="nome" required /></Campo>
              <Campo label="Início"><input type="date" name="data_inicio" /></Campo>
              <Campo label="Fim"><input type="date" name="data_fim" /></Campo>
            </div>
            <div style={{ marginTop: 14 }}><button className="btn" type="submit">Criar missão</button></div>
          </form>
        )}
      </div>
    </>
  );
}
