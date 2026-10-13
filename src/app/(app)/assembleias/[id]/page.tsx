import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { ASSEMBLEIA_STATUS, fmtData, MATERIA_LABEL } from '@/lib/format';
import { isUuid } from '@/lib/form';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import {
  adicionarDeliberacao, encerrarAssembleia, instalarAssembleia, salvarPresencaAssembleia, vincularAdmissao,
} from '../actions';

type Ass = {
  id: string; tipo: string; titulo: string; convocada_por: string; data_convocacao: string; data_realizacao: string;
  canais_divulgacao: string[] | null; convocacao_numero: number; associados_aptos: number | null;
  presentes: number | null; status: string; quorum_ok: boolean;
};
type Pres = { id: string; nome: string; modalidade: string | null };
type Delib = {
  id: string; materia: string; descricao: string; votos_favor: number; votos_contra: number;
  abstencoes: number; voto_qualidade: boolean; resultado: string | null;
};

export default async function AssembleiaPage({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const u = await requirePerm('assembleias:ler');
  if (!isUuid(params.id)) notFound();
  const podeEscrever = can(u.papel, 'assembleias:escrever');

  const r = await run(u.id, async (tx) => {
    const [a] = await tx<Ass[]>`
      select id, tipo::text, titulo, convocada_por, data_convocacao, data_realizacao, canais_divulgacao,
             convocacao_numero, associados_aptos, presentes, status,
             gov.quorum_instalacao(tipo, convocacao_numero, coalesce(associados_aptos,0), coalesce(presentes,0)) as quorum_ok
        from gov.assembleia where id = ${params.id}
    `;
    if (!a) return null;
    const pres = await tx<Pres[]>`
      select s.id, s.nome, p.modalidade
        from gov.associado s
        left join gov.assembleia_presenca p on p.assembleia_id = ${params.id} and p.associado_id = s.id
       where p.associado_id is not null
          or (s.status = 'associado' and s.data_admissao <= ${a.data_realizacao})
       order by s.nome
    `;
    const delibs = await tx<Delib[]>`
      select id, materia::text, descricao, votos_favor, votos_contra, abstencoes, voto_qualidade, resultado
        from gov.deliberacao where assembleia_id = ${params.id} order by criado_em
    `;
    const pendentes = await tx<{ id: string; nome: string; proposto: string | null }[]>`
      select s.id, s.nome, p.nome as proposto
        from gov.associado s left join gov.associado p on p.id = s.proposto_por
       where s.proposto_por is not null and s.admissao_deliberacao_id is null
         and s.status in ('interessado','em_acompanhamento')
       order by s.nome
    `;
    return { a, pres, delibs, pendentes };
  });
  if (!r) notFound();
  const { a, pres, delibs, pendentes } = r;
  const st = ASSEMBLEIA_STATUS[a.status];
  const aberta = a.status === 'convocada';
  const deliberavel = a.status === 'instalada' || a.status === 'realizada';
  const admissoesAprovadas = delibs.filter((d) => d.materia === 'admissao_associado' && d.resultado === 'aprovada');

  return (
    <>
      <PageHead titulo={a.titulo} sub={`${a.tipo} · ${a.convocacao_numero}ª convocação · realização ${fmtData(a.data_realizacao)}`}>
        <Chip tom={st.tom}>{st.rotulo}</Chip>
        <a className="btn sec" href={`/api/documentos/edital/${a.id}`} target="_blank" rel="noreferrer">Edital (PDF)</a>
        <a className="btn sec" href={`/api/documentos/presenca/${a.id}?t=assembleia`} target="_blank" rel="noreferrer">Lista de presença (PDF)</a>
        {(a.status === 'instalada' || a.status === 'realizada') && (
          <a className="btn sec" href={`/api/documentos/ata/${a.id}`} target="_blank" rel="noreferrer">Ata (PDF)</a>
        )}
        <Link className="btn sec" href="/assembleias">Voltar</Link>
      </PageHead>
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      <div className="grid g4" style={{ marginBottom: 18 }}>
        <div className="kpi"><b>{a.associados_aptos ?? '—'}</b><span>Associados aptos (na convocação)</span></div>
        <div className="kpi"><b>{a.presentes ?? 0}</b><span>Presentes</span></div>
        <div className="kpi"><b style={{ color: a.quorum_ok ? 'var(--ok-ink)' : 'var(--bad-ink)' }}>{a.quorum_ok ? 'Sim' : 'Não'}</b><span>Quórum de instalação atingido</span></div>
        <div className="kpi"><b>{fmtData(a.data_convocacao)}</b><span>Convocada · {(a.canais_divulgacao ?? []).join(', ') || 'sem canais'}</span></div>
      </div>

      <form action={salvarPresencaAssembleia} className="card tabela">
        <h2>Lista de presença</h2>
        <input type="hidden" name="assembleia_id" value={a.id} />
        {pres.length === 0 ? <p className="vazio">Nenhum associado apto.</p> : (
          <fieldset disabled={!podeEscrever || !['convocada', 'instalada'].includes(a.status)}>
            <table>
              <thead><tr><th>Presente</th><th>Associado</th><th>Modalidade</th></tr></thead>
              <tbody>
                {pres.map((p) => (
                  <tr key={p.id}>
                    <td><input type="hidden" name="assoc" value={p.id} />
                      <input type="checkbox" name={`p_${p.id}`} defaultChecked={p.modalidade !== null} aria-label={`Presença de ${p.nome}`} /></td>
                    <td>{p.nome}</td>
                    <td><select name={`m_${p.id}`} defaultValue={p.modalidade ?? 'presencial'} style={{ maxWidth: 160 }}>
                      <option value="presencial">Presencial</option><option value="remota">Remota</option></select></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {podeEscrever && <div style={{ marginTop: 14 }}><button className="btn" type="submit">Salvar presenças</button></div>}
          </fieldset>
        )}
      </form>

      {podeEscrever && (
        <div className="card">
          <h2>Andamento</h2>
          <div className="acoes">
            {aberta && (
              <form action={instalarAssembleia}><input type="hidden" name="id" value={a.id} />
                <button className="btn" type="submit">Conferir quórum e instalar</button></form>
            )}
            {['convocada', 'instalada'].includes(a.status) && (
              <form action={encerrarAssembleia} className="acoes"><input type="hidden" name="id" value={a.id} />
                {a.status === 'instalada' && <button className="btn sec" type="submit" name="acao" value="realizada">Encerrar assembleia</button>}
                <button className="btn perigo" type="submit" name="acao" value="cancelada">Cancelar</button></form>
            )}
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            Quórum: AGO 1ª convocação = metade + 1; 2ª e 3ª = qualquer número. AGE 1ª = maioria absoluta; 2ª = 1/3; 3ª = 10%.
          </p>
        </div>
      )}

      <div className="card tabela">
        <h2>Deliberações</h2>
        {delibs.length === 0 ? <p className="vazio">Nenhuma deliberação registrada.</p> : (
          <table>
            <thead><tr><th>Matéria</th><th>Votos</th><th>Resultado</th></tr></thead>
            <tbody>
              {delibs.map((d) => (
                <tr key={d.id}>
                  <td>{MATERIA_LABEL[d.materia]}<div className="muted">{d.descricao}</div></td>
                  <td className="muted">{d.votos_favor} a favor · {d.votos_contra} contra · {d.abstencoes} abst.{d.voto_qualidade && ' · voto de qualidade'}</td>
                  <td><Chip tom={d.resultado === 'aprovada' ? 'ok' : 'bad'}>{d.resultado === 'aprovada' ? 'Aprovada' : 'Rejeitada'}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {podeEscrever && deliberavel && (
        <form action={adicionarDeliberacao} className="card">
          <h2>Registrar deliberação</h2>
          <input type="hidden" name="assembleia_id" value={a.id} />
          <div className="form-grid">
            <Campo label="Matéria">
              <select name="materia" defaultValue="contas_anuais">
                {Object.entries(MATERIA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <Campo label="O que foi votado" className="larga"><textarea name="descricao" required /></Campo>
            <Campo label="Votos a favor"><input type="number" name="votos_favor" min={0} defaultValue={0} /></Campo>
            <Campo label="Votos contra"><input type="number" name="votos_contra" min={0} defaultValue={0} /></Campo>
            <Campo label="Abstenções"><input type="number" name="abstencoes" min={0} defaultValue={0} /></Campo>
            <div className="larga acoes">
              <label className="check"><input type="checkbox" name="voto_qualidade" /> Houve empate e o presidente usou o voto de qualidade (Art. 15)</label>
              <select name="resultado_empate" defaultValue="aprovada" style={{ maxWidth: 200 }}>
                <option value="aprovada">Presidente votou a favor</option>
                <option value="rejeitada">Presidente votou contra</option>
              </select>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            O resultado é calculado pelo sistema: estatuto e destituição exigem 50% + 1 dos presentes; exclusão, maioria absoluta dos aptos; demais matérias, mais votos a favor que contra.
          </p>
          <div style={{ marginTop: 10 }}><button className="btn" type="submit">Registrar</button></div>
        </form>
      )}

      {podeEscrever && admissoesAprovadas.length > 0 && pendentes.length > 0 && (
        <form action={vincularAdmissao} className="card">
          <h2>Ligar aprovação de admissão ao associado</h2>
          <p className="muted">Admissão proposta por outro associado precisa de aprovação em assembleia (Art. 7, n).</p>
          <input type="hidden" name="assembleia_id" value={a.id} />
          <div className="form-grid">
            <Campo label="Deliberação aprovada">
              <select name="deliberacao_id" required>
                {admissoesAprovadas.map((d) => <option key={d.id} value={d.id}>{d.descricao.slice(0, 70)}</option>)}
              </select>
            </Campo>
            <Campo label="Associado proposto">
              <select name="associado_id" required defaultValue="">
                <option value="" disabled>Escolha…</option>
                {pendentes.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.proposto ? ` (proposto por ${p.proposto})` : ''}</option>)}
              </select>
            </Campo>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn" type="submit">Ligar</button></div>
        </form>
      )}
    </>
  );
}
