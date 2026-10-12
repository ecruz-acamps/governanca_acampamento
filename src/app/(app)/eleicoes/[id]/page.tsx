import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { CARGO_LABEL, ELEICAO_STATUS, fmtData, hoje } from '@/lib/format';
import { isUuid } from '@/lib/form';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import {
  abrirCandidaturas, abrirVotacao, adicionarCandidatura, apurar, empossarEleitos, removerCandidatura, votar,
} from '../actions';

type El = { id: string; ano: number; data_eleicao: string; status: string; indicar_ate: string; apresentar_ate: string; limite: string };
type Cand = {
  id: string; nome: string; cargo: string; rodada: number; resultado: string; concordo: number; discordo: number; indicado_em: string | null;
};

export default async function EleicaoPage({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const u = await requirePerm('eleicoes:ler');
  if (!isUuid(params.id)) notFound();
  const pode = can(u.papel, 'eleicoes:escrever');

  const r = await run(u.id, async (tx) => {
    const [e] = await tx<El[]>`
      select e.id, e.ano, e.data_eleicao, e.status, v.indicar_candidatos_ate as indicar_ate,
             v.apresentar_na_secretaria_ate as apresentar_ate, v.limite_estatutario as limite
        from gov.eleicao e join gov.v_prazos_eleicao v on v.eleicao_id = e.id where e.id = ${params.id}
    `;
    if (!e) return null;
    const cands = await tx<Cand[]>`
      select c.id, a.nome, c.cargo::text, c.rodada, c.resultado, c.votos_concordo as concordo, c.votos_discordo as discordo, c.indicado_em
        from gov.candidatura c join gov.associado a on a.id = c.associado_id
       where c.eleicao_id = ${params.id} order by c.rodada, c.cargo, a.nome
    `;
    const assoc = await tx<{ id: string; nome: string; senior: boolean }[]>`
      select id, nome, participou_missao_senior as senior from gov.associado where status = 'associado' order by nome
    `;
    const [eu] = await tx<{ associado_id: string | null }[]>`select associado_id from gov.usuario where id = ${u.id}`;
    const [{ rod }] = await tx<{ rod: number }[]>`select gov.rodada_atual(${params.id}::uuid) as rod`;
    const [{ votaram }] = await tx<{ votaram: number }[]>`
      select count(*)::int as votaram from gov.eleitor_participacao where eleicao_id = ${params.id} and rodada = ${rod}
    `;
    const [{ aptos }] = await tx<{ aptos: number }[]>`select count(*)::int as aptos from gov.associado where status = 'associado'`;
    const jaVotei = eu?.associado_id
      ? (await tx`select 1 from gov.eleitor_participacao where eleicao_id = ${params.id} and rodada = ${rod} and associado_id = ${eu.associado_id}`).length > 0
      : false;
    return { e, cands, assoc, rod, votaram, aptos, jaVotei, podeVotar: !!eu?.associado_id };
  });
  if (!r) notFound();
  const { e, cands, assoc, rod, votaram, aptos, jaVotei, podeVotar } = r;
  const st = ELEICAO_STATUS[e.status];
  const pendentes = cands.filter((c) => c.rodada === rod && c.resultado === 'pendente');
  const rodadas = Array.from(new Set(cands.map((c) => c.rodada)));
  const rejeitados = cands.filter((c) => c.resultado === 'rejeitado').length;

  return (
    <>
      <PageHead titulo={`Eleição ${e.ano}`} sub={`Data: ${fmtData(e.data_eleicao)} · limite estatutário ${fmtData(e.limite)}`}>
        <Chip tom={st.tom}>{st.rotulo}</Chip>
        <Link className="btn sec" href="/eleicoes">Voltar</Link>
      </PageHead>
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      <div className="card">
        <h3>Prazos (Art. 29)</h3>
        <p>Indicação de candidatos até <b>{fmtData(e.indicar_ate)}</b> · apresentação na secretaria até <b>{fmtData(e.apresentar_ate)}</b>.</p>
        <p className="muted">Se um candidato for rejeitado (mais “discordo” que “concordo”), indica-se novo nome em até 15 dias e há nova rodada (Art. 30, parágrafo único).</p>
      </div>

      {pode && ['planejada', 'apurada'].includes(e.status) && (
        <form action={abrirCandidaturas} className="card">
          <input type="hidden" name="id" value={e.id} />
          <h3>{e.status === 'planejada' ? 'Abrir candidaturas' : 'Nova rodada de candidaturas'}</h3>
          {e.status === 'apurada' && rejeitados === 0 && <p className="muted">Nenhum candidato foi rejeitado; só abra nova rodada se precisar incluir novos nomes.</p>}
          <button className="btn" type="submit">Abrir candidaturas</button>
        </form>
      )}

      {pode && e.status === 'candidaturas' && (
        <form action={adicionarCandidatura} className="card">
          <input type="hidden" name="id" value={e.id} />
          <h3>Registrar candidato</h3>
          <div className="form-grid">
            <Campo label="Associado">
              <select name="associado_id" required defaultValue="">
                <option value="" disabled>Escolha…</option>
                {assoc.map((a) => <option key={a.id} value={a.id}>{a.nome}{a.senior ? ' (missão do sênior)' : ''}</option>)}
              </select>
            </Campo>
            <Campo label="Cargo" dica="Diretoria exige missão do sênior (Art. 16 §1)">
              <select name="cargo" required defaultValue="">
                <option value="" disabled>Escolha…</option>
                {Object.entries(CARGO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <Campo label="Indicado em"><input type="date" name="indicado_em" defaultValue={hoje()} /></Campo>
            <Campo label="Apresentado na secretaria em"><input type="date" name="apresentado_secretaria_em" /></Campo>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn" type="submit">Registrar</button></div>
        </form>
      )}

      {rodadas.map((rd) => (
        <div className="card tabela" key={rd}>
          <h2>Rodada {rd}</h2>
          <table>
            <thead><tr><th>Cargo</th><th>Candidato</th><th>Resultado</th><th></th></tr></thead>
            <tbody>
              {cands.filter((c) => c.rodada === rd).map((c) => (
                <tr key={c.id}>
                  <td>{CARGO_LABEL[c.cargo]}</td><td>{c.nome}</td>
                  <td>
                    {c.resultado === 'pendente' ? <Chip tom="mute">pendente</Chip> : (
                      <>
                        <Chip tom={c.resultado === 'eleito' ? 'ok' : 'bad'}>{c.resultado}</Chip>
                        <span className="muted"> concordo {c.concordo} · discordo {c.discordo}</span>
                      </>
                    )}
                  </td>
                  <td>
                    {pode && e.status === 'candidaturas' && c.resultado === 'pendente' && (
                      <form action={removerCandidatura}>
                        <input type="hidden" name="id" value={e.id} /><input type="hidden" name="candidatura_id" value={c.id} />
                        <button className="btn perigo mini" type="submit">Retirar</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {pode && e.status === 'candidaturas' && pendentes.length > 0 && (
        <form action={abrirVotacao} className="card">
          <input type="hidden" name="id" value={e.id} />
          <h3>Abrir votação</h3>
          <p className="muted">Depois de aberta, não dá mais para mexer nas candidaturas.</p>
          <button className="btn" type="submit">Abrir votação</button>
        </form>
      )}

      {e.status === 'votacao' && (
        <>
          <div className="card">
            <h3>Votação em andamento</h3>
            <p>{votaram} de {aptos} associados já votaram. O resultado só aparece depois da apuração.</p>
          </div>

          {podeVotar && !jaVotei && (
            <form action={votar} className="card">
              <input type="hidden" name="id" value={e.id} />
              <h3>Seu voto (secreto)</h3>
              <p className="muted">Ninguém, nem o administrador, consegue ver como você votou.</p>
              {pendentes.map((c) => (
                <fieldset key={c.id} style={{ margin: '12px 0' }}>
                  <b>{c.nome}</b> <span className="muted">— {CARGO_LABEL[c.cargo]}</span>
                  <div className="acoes" style={{ marginTop: 6 }}>
                    <label className="check"><input type="radio" name={`v_${c.id}`} value="concordo" required /> Concordo</label>
                    <label className="check"><input type="radio" name={`v_${c.id}`} value="discordo" /> Discordo</label>
                  </div>
                </fieldset>
              ))}
              <button className="btn" type="submit">Confirmar voto</button>
            </form>
          )}
          {podeVotar && jaVotei && <div className="flash ok">Seu voto desta rodada já foi registrado.</div>}
          {!podeVotar && <p className="muted">Sua conta não está ligada a um associado, por isso não vota.</p>}

          {pode && (
            <form action={apurar} className="card">
              <input type="hidden" name="id" value={e.id} />
              <h3>Encerrar e apurar</h3>
              <p className="muted">Vence quem tiver mais “concordo” que “discordo” (Art. 30). Não dá para desfazer.</p>
              <button className="btn perigo" type="submit">Encerrar votação e apurar</button>
            </form>
          )}
        </>
      )}

      {pode && e.status === 'apurada' && cands.some((c) => c.resultado === 'eleito') && pendentes.length === 0 && (
        <form action={empossarEleitos} className="card">
          <input type="hidden" name="id" value={e.id} />
          <h3>Posse dos eleitos</h3>
          <div className="form-grid">
            <Campo label="Início do mandato" dica="Mandato de 3 anos (Art. 16 §2 e Art. 21 §2)"><input type="date" name="inicio" defaultValue={hoje()} required /></Campo>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>Cria o novo ciclo e os mandatos dos eleitos. Encerre os mandatos antigos em Mandatos.</p>
          <button className="btn" type="submit">Empossar eleitos</button>
        </form>
      )}
    </>
  );
}
