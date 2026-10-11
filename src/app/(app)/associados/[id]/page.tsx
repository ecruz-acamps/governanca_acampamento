import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import {
  ACAMPAMENTO_LABEL, CARGO_LABEL, fmtData, hoje, STATUS_LABEL, STATUS_TOM,
} from '@/lib/format';
import { isUuid } from '@/lib/form';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { acompanhar, admitir, desligar, salvarAssociado } from '../actions';

type Assoc = {
  id: string; nome: string; email: string | null; telefone: string | null; data_nascimento: string | null;
  status: string; acampamento_tipo: string | null; acampamento_ano: number | null;
  primeira_eucaristia: boolean; participou_missao_senior: boolean; motivo_pedido: string | null;
  data_pedido: string | null; data_admissao: string | null; data_promessa: string | null;
  data_saida: string | null; motivo_saida: string | null; observacoes: string | null;
  proposto_por_nome: string | null; proposto_por: string | null; aprovado: boolean;
};

export default async function AssociadoPage({
  params, searchParams,
}: { params: { id: string }; searchParams: SP }) {
  const u = await requirePerm('associados:ler');
  const podeEscrever = can(u.papel, 'associados:escrever');
  const novo = params.id === 'novo';
  if (!novo && !isUuid(params.id)) notFound();
  if (novo && !podeEscrever) notFound();

  let a: Assoc | null = null;
  let freq: { ano: number; presencas: number; reunioes_no_periodo: number; percentual: string; abaixo_do_minimo: boolean }[] = [];
  let mandatos: { cargo: string; inicio: string; fim: string; situacao: string }[] = [];
  let outros: { id: string; nome: string }[] = [];

  if (!novo) {
    const r = await run(u.id, async (tx) => {
      const [x] = await tx<Assoc[]>`
        select a.id, a.nome, a.email, a.telefone, a.data_nascimento, a.status::text, a.acampamento_tipo::text,
               a.acampamento_ano, a.primeira_eucaristia, a.participou_missao_senior, a.motivo_pedido,
               a.data_pedido, a.data_admissao, a.data_promessa, a.data_saida, a.motivo_saida, a.observacoes,
               p.nome as proposto_por_nome, a.proposto_por, (a.admissao_deliberacao_id is not null) as aprovado
          from gov.associado a left join gov.associado p on p.id = a.proposto_por
         where a.id = ${params.id}
      `;
      if (!x) return null;
      const f = await tx<typeof freq>`
        select ano, presencas::int, reunioes_no_periodo::int, percentual::text, abaixo_do_minimo
          from gov.v_frequencia_anual where associado_id = ${params.id} order by ano desc
      `;
      const m = await tx<typeof mandatos>`
        select cargo::text, inicio, fim, situacao from gov.mandato
         where associado_id = ${params.id} order by inicio desc
      `;
      return { x, f, m };
    });
    if (!r) notFound();
    a = r.x; freq = r.f; mandatos = r.m;
  }
  outros = await run(u.id, (tx) => tx<typeof outros>`
    select id, nome from gov.associado where status = 'associado' and id <> ${novo ? '00000000-0000-0000-0000-000000000000' : params.id} order by nome
  `);

  const emAndamento = a && ['interessado', 'em_acompanhamento'].includes(a.status);
  const ativo = a && ['interessado', 'em_acompanhamento', 'associado', 'suspenso'].includes(a.status);

  return (
    <>
      <PageHead titulo={novo ? 'Novo cadastro' : a!.nome} sub={novo ? 'Interessado em ser associado' : undefined}>
        {a && <Chip tom={STATUS_TOM[a.status]}>{STATUS_LABEL[a.status]}</Chip>}
        <Link className="btn sec" href="/associados">Voltar</Link>
      </PageHead>
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      <form action={salvarAssociado} className="card">
        {a && <input type="hidden" name="id" value={a.id} />}
        <fieldset disabled={!podeEscrever}>
          <div className="form-grid">
            <Campo label="Nome completo" className="larga"><input type="text" name="nome" defaultValue={a?.nome} required /></Campo>
            <Campo label="E-mail"><input type="email" name="email" defaultValue={a?.email ?? ''} /></Campo>
            <Campo label="Telefone"><input type="text" name="telefone" defaultValue={a?.telefone ?? ''} /></Campo>
            <Campo label="Data de nascimento"><input type="date" name="data_nascimento" defaultValue={a?.data_nascimento ?? ''} /></Campo>
            <Campo label="Acampamento querigmático" dica="Art. 6 §1 a">
              <select name="acampamento_tipo" defaultValue={a?.acampamento_tipo ?? ''}>
                <option value="">—</option>
                {Object.entries(ACAMPAMENTO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <Campo label="Ano do acampamento"><input type="number" name="acampamento_ano" min={1970} max={2100} defaultValue={a?.acampamento_ano ?? ''} /></Campo>
            <Campo label="Data do pedido" dica="Art. 6 §1 b"><input type="date" name="data_pedido" defaultValue={a?.data_pedido ?? ''} /></Campo>
            <Campo label="Data da promessa" dica="Art. 6 §3"><input type="date" name="data_promessa" defaultValue={a?.data_promessa ?? ''} /></Campo>
            <div className="larga acoes">
              <label className="check"><input type="checkbox" name="primeira_eucaristia" defaultChecked={a?.primeira_eucaristia} /> Fez a 1ª Eucaristia</label>
              <label className="check"><input type="checkbox" name="participou_missao_senior" defaultChecked={a?.participou_missao_senior} /> Participou da missão do Sênior (exigido para a Diretoria, Art. 16 §1)</label>
            </div>
            <Campo label="Proposto por (associado)" dica="Só preencha se outro associado indicou esta pessoa (Art. 7, n): exige aprovação em assembleia" className="larga">
              <select name="proposto_por" defaultValue={a?.proposto_por ?? ''}>
                <option value="">— pedido da própria pessoa —</option>
                {outros.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Motivo do pedido" className="larga"><textarea name="motivo_pedido" defaultValue={a?.motivo_pedido ?? ''} /></Campo>
            <Campo label="Observações" className="larga"><textarea name="observacoes" defaultValue={a?.observacoes ?? ''} /></Campo>
          </div>
          {podeEscrever && <div style={{ marginTop: 16 }}><button className="btn" type="submit">Salvar</button></div>}
        </fieldset>
      </form>

      {a && podeEscrever && ativo && (
        <div className="card">
          <h2>Situação do associado</h2>
          <p className="muted">
            {a.status === 'interessado' && 'Para ser admitido é preciso: acampamento querigmático, 1ª Eucaristia e data de admissão (Art. 6).'}
            {a.status === 'em_acompanhamento' && 'Em acompanhamento. Quando cumprir os requisitos, registre a admissão.'}
            {a.status === 'associado' && `Associado desde ${fmtData(a.data_admissao)}.`}
            {a.proposto_por_nome && ` Proposto por ${a.proposto_por_nome}${a.aprovado ? ' — aprovado em assembleia.' : ' — aguardando aprovação em assembleia.'}`}
          </p>
          <div className="acoes">
            {a.status === 'interessado' && (
              <form action={acompanhar}><input type="hidden" name="id" value={a.id} />
                <button className="btn sec" type="submit">Iniciar acompanhamento</button></form>
            )}
            {emAndamento && (
              <form action={admitir} className="acoes"><input type="hidden" name="id" value={a.id} />
                <input type="date" name="data_admissao" defaultValue={hoje()} style={{ width: 160 }} />
                <button className="btn" type="submit">Admitir como associado</button></form>
            )}
          </div>
          <details style={{ marginTop: 14 }}>
            <summary className="muted" style={{ cursor: 'pointer' }}>Registrar desligamento (Art. 7, q)</summary>
            <form action={desligar} className="form-grid" style={{ marginTop: 10 }}>
              <input type="hidden" name="id" value={a.id} />
              <Campo label="Data da saída"><input type="date" name="data_saida" defaultValue={hoje()} /></Campo>
              <Campo label="Motivo"><input type="text" name="motivo_saida" /></Campo>
              <div><button className="btn perigo" type="submit">Desligar</button></div>
            </form>
          </details>
        </div>
      )}
      {a && a.data_saida && (
        <div className="card"><h2>Saída</h2>
          <p>Em {fmtData(a.data_saida)}{a.motivo_saida ? ` — ${a.motivo_saida}` : ''}.</p></div>
      )}

      {a && (
        <div className="grid g2">
          <div className="card">
            <h2>Frequência por ano</h2>
            {freq.length === 0 ? <p className="vazio">Sem reuniões contadas.</p> : (
              <table><tbody>
                {freq.map((f) => (
                  <tr key={f.ano}><td>{f.ano}</td><td className="muted">{f.presencas}/{f.reunioes_no_periodo}</td>
                    <td><Chip tom={f.abaixo_do_minimo ? 'bad' : 'ok'}>{f.percentual}%</Chip></td></tr>
                ))}
              </tbody></table>
            )}
          </div>
          <div className="card">
            <h2>Mandatos</h2>
            {mandatos.length === 0 ? <p className="vazio">Nenhum mandato.</p> : (
              <table><tbody>
                {mandatos.map((m, i) => (
                  <tr key={i}><td>{CARGO_LABEL[m.cargo] ?? m.cargo}</td>
                    <td className="muted">{fmtData(m.inicio)} a {fmtData(m.fim)}</td>
                    <td><Chip tom={m.situacao === 'ativo' ? 'ok' : 'mute'}>{m.situacao}</Chip></td></tr>
                ))}
              </tbody></table>
            )}
          </div>
        </div>
      )}
    </>
  );
}
