import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { fmtData, hoje, MEDIDA_LABEL, MOTIVO_LABEL, STATUS_PROC } from '@/lib/format';
import { isUuid } from '@/lib/form';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import {
  aplicarMedida, decidirRecurso, encerrarSemRecurso, registrarConsenso, registrarDefesa,
  registrarRecurso, vincularAssembleiaProcesso,
} from '../actions';

type P = {
  id: string; associado_id: string; nome: string; medida: string; motivo: string; descricao: string; status: string;
  aberto_em: string; consenso_registrado: boolean; defesa_apresentada_em: string | null; defesa_texto: string | null;
  aplicada_em: string | null; ciencia_pessoal_em: string | null; prazo_recurso: string | null; recurso_em: string | null;
  recurso_texto: string | null; prazo_assembleia: string | null; assembleia_id: string | null; resultado: string | null;
  assembleia_titulo: string | null; vencido_recurso: boolean;
};

export default async function ProcessoPage({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const u = await requirePerm('disciplinar:ler');
  if (!isUuid(params.id)) notFound();
  const podeEscrever = can(u.papel, 'disciplinar:escrever');

  const r = await run(u.id, async (tx) => {
    const [p] = await tx<P[]>`
      select p.id, p.associado_id, a.nome, p.medida::text, p.motivo::text, p.descricao, p.status, p.aberto_em,
             p.consenso_registrado, p.defesa_apresentada_em, p.defesa_texto, p.aplicada_em, p.ciencia_pessoal_em,
             p.prazo_recurso, p.recurso_em, p.recurso_texto, p.prazo_assembleia, p.assembleia_id, p.resultado,
             s.titulo as assembleia_titulo, (p.prazo_recurso < current_date) as vencido_recurso
        from gov.processo_disciplinar p join gov.associado a on a.id = p.associado_id
        left join gov.assembleia s on s.id = p.assembleia_id
       where p.id = ${params.id}
    `;
    if (!p) return null;
    const assembleias = await tx<{ id: string; titulo: string; data_realizacao: string }[]>`
      select id, titulo, data_realizacao from gov.assembleia
       where status in ('instalada','realizada') order by data_realizacao desc limit 50
    `;
    return { p, assembleias };
  });
  if (!r) notFound();
  const { p, assembleias } = r;
  const st = STATUS_PROC[p.status];

  return (
    <>
      <PageHead titulo={p.nome} sub={`${MEDIDA_LABEL[p.medida]} · ${MOTIVO_LABEL[p.motivo]}`}>
        <Chip tom={st.tom}>{st.rotulo}</Chip>
        <Link className="btn sec" href="/disciplinar">Voltar</Link>
      </PageHead>
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      <div className="card">
        <h2>Fatos</h2>
        <p style={{ whiteSpace: 'pre-wrap' }}>{p.descricao}</p>
        <p className="muted">Aberto em {fmtData(p.aberto_em)}{p.resultado && ` · resultado: ${p.resultado}`}</p>
      </div>

      <div className="grid g2">
        <div className="card">
          <h3>1. Consenso (Art. 8 §1)</h3>
          {p.consenso_registrado ? <Chip tom="ok">Registrado</Chip> : (
            <>
              <p className="muted">Coordenação geral, em consenso com o conselho e o orientador espiritual.</p>
              {podeEscrever && p.status === 'aberto' && (
                <form action={registrarConsenso}><input type="hidden" name="id" value={p.id} />
                  <button className="btn sec" type="submit">Registrar consenso</button></form>
              )}
            </>
          )}
        </div>
        <div className="card">
          <h3>2. Defesa</h3>
          {p.defesa_apresentada_em ? (
            <><Chip tom="ok">Registrada em {fmtData(p.defesa_apresentada_em)}</Chip>
              <p style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{p.defesa_texto}</p></>
          ) : podeEscrever && p.status === 'aberto' ? (
            <form action={registrarDefesa} className="form-grid">
              <input type="hidden" name="id" value={p.id} />
              <Campo label="Data"><input type="date" name="defesa_em" defaultValue={hoje()} /></Campo>
              <Campo label="Defesa apresentada (ou “não se manifestou no prazo”)" className="larga"><textarea name="defesa_texto" required /></Campo>
              <div><button className="btn sec" type="submit">Registrar defesa</button></div>
            </form>
          ) : <p className="vazio">Ainda sem defesa.</p>}
        </div>
      </div>

      {podeEscrever && p.status !== 'encerrada' && (
        <form action={vincularAssembleiaProcesso} className="card">
          <h3>Assembleia ligada ao processo</h3>
          <p className="muted">
            Necessária para exclusão (deliberação aprovada de “Exclusão de associado”) e para decidir o recurso.
            {p.assembleia_titulo && ` Atual: ${p.assembleia_titulo}.`}
          </p>
          <input type="hidden" name="id" value={p.id} />
          <div className="acoes">
            <select name="assembleia_id" defaultValue={p.assembleia_id ?? ''} style={{ maxWidth: 420 }}>
              <option value="" disabled>Escolha…</option>
              {assembleias.map((a) => <option key={a.id} value={a.id}>{fmtData(a.data_realizacao)} — {a.titulo}</option>)}
            </select>
            <button className="btn sec" type="submit">Ligar</button>
          </div>
        </form>
      )}

      {podeEscrever && p.status === 'aberto' && (
        <form action={aplicarMedida} className="card">
          <h3>3. Aplicar a medida</h3>
          <p className="muted">O recurso não suspende os efeitos da medida (Art. 8 §2). Suspensão e exclusão mudam o status do associado agora.</p>
          <input type="hidden" name="id" value={p.id} />
          <div className="form-grid">
            <Campo label="Data da aplicação"><input type="date" name="aplicada_em" defaultValue={hoje()} /></Campo>
            <Campo label="Ciência pessoal do associado" dica="Começa a contar os 5 dias de recurso"><input type="date" name="ciencia_em" defaultValue={hoje()} /></Campo>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn perigo" type="submit">Aplicar {MEDIDA_LABEL[p.medida].toLowerCase()}</button></div>
        </form>
      )}

      {p.aplicada_em && (
        <div className="card">
          <h3>Medida aplicada</h3>
          <p>Aplicada em {fmtData(p.aplicada_em)} · ciência pessoal em {fmtData(p.ciencia_pessoal_em)} · prazo de recurso até {fmtData(p.prazo_recurso)}.</p>
          {podeEscrever && p.status === 'aplicada' && (
            <div className="grid g2" style={{ marginTop: 10 }}>
              <form action={registrarRecurso} className="form-grid">
                <input type="hidden" name="id" value={p.id} />
                <Campo label="Data do recurso"><input type="date" name="recurso_em" defaultValue={hoje()} /></Campo>
                <Campo label="Razões do recurso" className="larga"><textarea name="recurso_texto" /></Campo>
                <label className="check larga"><input type="checkbox" name="protocolado" /> Protocolado na secretaria paroquial</label>
                <div><button className="btn" type="submit">Registrar recurso</button></div>
              </form>
              {p.vencido_recurso && (
                <form action={encerrarSemRecurso}>
                  <input type="hidden" name="id" value={p.id} />
                  <p className="muted">O prazo de 5 dias passou sem recurso.</p>
                  <button className="btn sec" type="submit">Encerrar processo</button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {p.recurso_em && (
        <div className="card">
          <h3>Recurso</h3>
          <p>Apresentado em {fmtData(p.recurso_em)} · a assembleia deve decidir até {fmtData(p.prazo_assembleia)} (30 dias).</p>
          {p.recurso_texto && <p style={{ whiteSpace: 'pre-wrap' }}>{p.recurso_texto}</p>}
          {podeEscrever && p.status === 'em_recurso' && (
            <form action={decidirRecurso} className="acoes">
              <input type="hidden" name="id" value={p.id} />
              <select name="resultado" defaultValue="mantida" style={{ maxWidth: 260 }}>
                <option value="mantida">Medida mantida</option>
                <option value="revogada">Medida revogada (devolve o status)</option>
                <option value="convertida">Medida convertida</option>
              </select>
              <button className="btn" type="submit">Registrar decisão da assembleia</button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
