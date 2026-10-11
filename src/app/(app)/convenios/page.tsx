import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { CONVENIO_STATUS, CONVENIO_TIPO_LABEL, fmtData, fmtMoeda, hoje } from '@/lib/format';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { aprovarConvenio, criarConvenio, decidirConvenio } from './actions';

type C = {
  id: string; tipo: string; origem_nome: string; descricao: string | null; valor_previsto: string | null;
  verba_publica: boolean; finalidade_vinculada: string | null; status: string;
  aprovado_conselho_em: string | null; aprovado_orientacao_espiritual_em: string | null;
  aprovado_coordenacao_geral_em: string | null;
};

const ETAPAS = [
  { chave: 'conselho', rotulo: 'Conselho', campo: 'aprovado_conselho_em' },
  { chave: 'espiritual', rotulo: 'Orientação espiritual', campo: 'aprovado_orientacao_espiritual_em' },
  { chave: 'coordenacao', rotulo: 'Coordenação geral', campo: 'aprovado_coordenacao_geral_em' },
] as const;

export default async function ConveniosPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePerm('convenios:ler');
  const pode = can(u.papel, 'convenios:escrever');
  const itens = await run(u.id, (tx) => tx<C[]>`
    select id, tipo::text, origem_nome, descricao, valor_previsto::text, verba_publica, finalidade_vinculada, status,
           aprovado_conselho_em, aprovado_orientacao_espiritual_em, aprovado_coordenacao_geral_em
      from gov.convenio_doacao order by criado_em desc limit 200
  `);

  return (
    <>
      <PageHead titulo="Convênios e doações" sub="Aceite exige três aprovações: Conselho, orientação espiritual e coordenação geral (Art. 5)" />
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      {pode && (
        <form action={criarConvenio} className="card">
          <h2>Novo registro</h2>
          <div className="form-grid">
            <Campo label="Tipo">
              <select name="tipo" defaultValue="doacao">
                {Object.entries(CONVENIO_TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <Campo label="Origem (quem doa ou concede)"><input type="text" name="origem_nome" required /></Campo>
            <Campo label="Valor previsto (R$)"><input type="text" name="valor_previsto" inputMode="decimal" placeholder="1.500,00" /></Campo>
            <Campo label="Finalidade vinculada" dica="Verba com finalidade definida só pode ser aplicada nela (Art. 27 §3)"><input type="text" name="finalidade" /></Campo>
            <Campo label="Descrição" className="larga"><textarea name="descricao" /></Campo>
            <label className="check larga"><input type="checkbox" name="verba_publica" /> É verba pública (exige relatório trimestral, Art. 20 g)</label>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn" type="submit">Registrar</button></div>
        </form>
      )}

      {itens.length === 0 ? <div className="card"><p className="vazio">Nenhum convênio ou doação registrado.</p></div> : itens.map((c) => {
        const st = CONVENIO_STATUS[c.status];
        return (
          <div className="card" key={c.id}>
            <div className="head" style={{ marginBottom: 8 }}>
              <div>
                <h2>{c.origem_nome}</h2>
                <div className="muted">{CONVENIO_TIPO_LABEL[c.tipo]} · {fmtMoeda(c.valor_previsto)}{c.verba_publica && ' · verba pública'}</div>
              </div>
              <Chip tom={st.tom}>{st.rotulo}</Chip>
            </div>
            {c.descricao && <p>{c.descricao}</p>}
            {c.finalidade_vinculada && <p className="muted">Finalidade vinculada: {c.finalidade_vinculada}</p>}
            <table><tbody>
              {ETAPAS.map((e) => {
                const data = c[e.campo];
                return (
                  <tr key={e.chave}>
                    <td style={{ width: '34%' }}>{e.rotulo}</td>
                    <td>
                      {data ? <Chip tom="ok">Aprovado em {fmtData(data)}</Chip> : pode && c.status === 'em_analise' ? (
                        <form action={aprovarConvenio} className="acoes">
                          <input type="hidden" name="id" value={c.id} /><input type="hidden" name="etapa" value={e.chave} />
                          <input type="date" name="data" defaultValue={hoje()} style={{ width: 160 }} />
                          <button className="btn sec mini" type="submit">Registrar aprovação</button>
                        </form>
                      ) : <Chip tom="warn">Pendente</Chip>}
                    </td>
                  </tr>
                );
              })}
            </tbody></table>
            {pode && c.status === 'em_analise' && (
              <form action={decidirConvenio} className="acoes" style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={c.id} />
                <button className="btn" type="submit" name="acao" value="aceito">Aceitar</button>
                <button className="btn perigo" type="submit" name="acao" value="recusado">Recusar</button>
              </form>
            )}
          </div>
        );
      })}
    </>
  );
}
