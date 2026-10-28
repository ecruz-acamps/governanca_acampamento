import Link from 'next/link';
import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { distribuirFichas, type NucleoEntrada } from '@/lib/fichas';
import { isUuid } from '@/lib/form';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { alternarNucleo, criarDistribuicao, criarNucleo, excluirDistribuicao, salvarDistribuicao, salvarNucleo } from './actions';

type Dist = { id: string; titulo: string; ano: number; total_fichas: number; reserva_fichas: number };
type Nuc = { id: string; nome: string; tipo: 'nucleo' | 'cortesia'; fichas_fixas: number | null; ativo: boolean; pre_fichas: number; pre_fora: number; separa_origem: boolean };

export default async function FichasPage({ searchParams }: { searchParams: SP & { d?: string } }) {
  const u = await requirePerm('fichas:ler');
  const podeEscrever = can(u.papel, 'fichas:escrever');

  const { dists, sel, nucleos } = await run(u.id, async (tx) => {
    const dists = await tx<Dist[]>`select id, titulo, ano, total_fichas, reserva_fichas from gov.distribuicao_fichas order by ano desc, criado_em desc`;
    const sel = dists.find((d) => d.id === searchParams.d) ?? dists[0] ?? null;
    const nucleos = await tx<Nuc[]>`
      select n.id, n.nome, n.tipo, n.fichas_fixas, n.ativo, n.separa_origem, coalesce(p.pre_fichas, 0) as pre_fichas, coalesce(p.pre_fora, 0) as pre_fora
        from gov.nucleo n
        left join gov.distribuicao_pre p on p.nucleo_id = n.id and p.distribuicao_id = ${sel?.id && isUuid(sel.id) ? sel.id : null}
       order by n.ativo desc, n.tipo, n.nome`;
    return { dists, sel, nucleos };
  });

  const ativos = nucleos.filter((n) => n.ativo);
  const entradas: NucleoEntrada[] = ativos.map((n) => ({
    id: n.id, nome: n.nome, tipo: n.tipo, fichasFixas: n.fichas_fixas, preFichas: n.pre_fichas + (n.separa_origem ? n.pre_fora : 0),
  }));
  const calc = sel ? distribuirFichas(sel.total_fichas, entradas) : null;
  const porId = new Map(calc?.linhas.map((l) => [l.id, l]) ?? []);
  const qtdNucleos = ativos.filter((n) => n.tipo === 'nucleo').length;

  return (
    <>
      <PageHead titulo="Fichas por núcleo" sub={`${qtdNucleos} núcleos ativos · divisão pelas pré-fichas (lista de espera)`} />
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      {dists.length > 0 && (
        <div className="card">
          <div className="acoes">
            {dists.map((d) => (
              <Link key={d.id} className={`btn ${sel?.id === d.id ? '' : 'sec'} mini`} href={`/fichas?d=${d.id}`}>{d.titulo}</Link>
            ))}
          </div>
        </div>
      )}

      {sel && calc && (
        <form action={salvarDistribuicao} className="card tabela">
          <h2>{sel.titulo} · {sel.ano}</h2>
          <input type="hidden" name="id" value={sel.id} />
          <div className="grid g4" style={{ marginBottom: 14 }}>
            <div className="kpi"><b>{sel.total_fichas}</b><span>Fichas para os núcleos</span></div>
            <div className="kpi"><b>{calc.fixos}</b><span>Fixas e cortesia</span></div>
            <div className="kpi"><b>{Math.max(calc.restante, 0)}</b><span>A dividir entre os núcleos</span></div>
            <div className="kpi"><b>{calc.somaPre}</b><span>Pré-fichas (núcleos proporcionais)</span></div>
            <div className="kpi"><b>{sel.reserva_fichas}</b><span>Reserva: emergência e padres</span></div>
            <div className="kpi"><b>{sel.total_fichas + sel.reserva_fichas}</b><span>Total geral do acampamento</span></div>
          </div>
          {calc.erro && <p className="muted" role="alert" style={{ color: 'var(--bad-ink)' }}>{calc.erro}</p>}
          <fieldset disabled={!podeEscrever}>
            <div className="form-grid">
              <Campo label="Fichas para os núcleos" dica="inclui as fixas de Anitápolis e a cortesia de Alfredo Wagner">
                <input type="number" name="total" min={0} defaultValue={sel.total_fichas} required />
              </Campo>
              <Campo label="Reserva (emergência e padres)" dica="fora da divisão">
                <input type="number" name="reserva" min={0} defaultValue={sel.reserva_fichas} required />
              </Campo>
            </div>
            <table style={{ marginTop: 12 }}>
              <thead><tr><th>Núcleo</th><th>Pré-fichas</th><th>% da divisão</th><th>Fichas</th></tr></thead>
              <tbody>
                {ativos.map((n) => {
                  const l = porId.get(n.id);
                  const fixo = n.fichas_fixas !== null;
                  return (
                    <tr key={n.id}>
                      <td>
                        <input type="hidden" name="nucleo" value={n.id} />
                        {n.nome}{' '}
                        {n.tipo === 'cortesia' ? <Chip tom="warn">cortesia (não é núcleo)</Chip> : fixo ? <Chip tom="warn">fixo</Chip> : null}
                      </td>
                      <td>
                        {n.separa_origem ? (
                          <div className="acoes">
                            <label className="muted">dentro <input type="number" name={`pre_${n.id}`} min={0} defaultValue={n.pre_fichas} style={{ maxWidth: 90 }} /></label>
                            <label className="muted">fora <input type="number" name={`fora_${n.id}`} min={0} defaultValue={n.pre_fora} style={{ maxWidth: 90 }} /></label>
                            {fixo && <span className="muted">(fixo: não entra no cálculo)</span>}
                          </div>
                        ) : fixo
                          ? <span className="muted">não entra no cálculo</span>
                          : <input type="number" name={`pre_${n.id}`} min={0} defaultValue={n.pre_fichas} style={{ maxWidth: 110 }} />}
                      </td>
                      <td>{l?.percentual != null ? `${l.percentual.toFixed(1).replace('.', ',')}%` : '—'}</td>
                      <td><b>{l?.fichas ?? 0}</b></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr><td><b>Total distribuído</b></td><td /><td /><td><b>{calc.linhas.reduce((a, l) => a + l.fichas, 0)}</b></td></tr>
              </tfoot>
            </table>
            {podeEscrever && <div style={{ marginTop: 14 }}><button className="btn" type="submit">Salvar e recalcular</button></div>}
          </fieldset>
          <p className="muted" style={{ marginTop: 10 }}>
            Regra: as fichas fixas e a cortesia saem primeiro; o restante é dividido entre os demais núcleos na proporção das
            pré-fichas, arredondando pelo maior resto para a soma fechar no total.
          </p>
        </form>
      )}

      {podeEscrever && (
        <form action={criarDistribuicao} className="card">
          <h2>Nova distribuição</h2>
          <div className="form-grid">
            <Campo label="Título"><input type="text" name="titulo" placeholder="Acampamento 2027" required /></Campo>
            <Campo label="Ano"><input type="number" name="ano" min={2000} max={2100} defaultValue={new Date().getFullYear() + 1} required /></Campo>
            <Campo label="Fichas para os núcleos"><input type="number" name="total" min={0} defaultValue={120} required /></Campo>
            <Campo label="Reserva (emergência e padres)"><input type="number" name="reserva" min={0} defaultValue={8} required /></Campo>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn" type="submit">Criar</button></div>
        </form>
      )}

      <div className="card tabela">
        <h2>Núcleos</h2>
        <p className="muted">Deixe “fichas fixas” vazio para o núcleo entrar na divisão proporcional. Anitápolis tem 10 fixas (acordo com a prefeitura) e Alfredo Wagner recebe 2 de cortesia.</p>
        <table>
          <thead><tr><th>Núcleo</th><th>Fichas fixas</th><th>Situação</th></tr></thead>
          <tbody>
            {nucleos.map((n) => (
              <tr key={n.id}>
                <td>{n.nome} {n.tipo === 'cortesia' && <Chip tom="warn">cortesia</Chip>}</td>
                <td>
                  {podeEscrever ? (
                    <form action={salvarNucleo} className="acoes">
                      <input type="hidden" name="id" value={n.id} /><input type="hidden" name="d" value={sel?.id ?? ''} />
                      <input type="number" name="fixas" min={0} defaultValue={n.fichas_fixas ?? ''} placeholder="proporcional" style={{ maxWidth: 120 }} required={n.tipo === 'cortesia'} />
                      <button className="btn sec mini" type="submit">Salvar</button>
                    </form>
                  ) : (n.fichas_fixas ?? 'proporcional')}
                </td>
                <td>
                  <div className="acoes">
                    {n.ativo ? <Chip tom="ok">ativo</Chip> : <Chip>inativo</Chip>}
                    {podeEscrever && (
                      <form action={alternarNucleo}>
                        <input type="hidden" name="id" value={n.id} /><input type="hidden" name="d" value={sel?.id ?? ''} />
                        <button className="btn sec mini" type="submit">{n.ativo ? 'Desativar' : 'Reativar'}</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {podeEscrever && (
          <form action={criarNucleo} className="acoes" style={{ marginTop: 14 }}>
            <input type="hidden" name="d" value={sel?.id ?? ''} />
            <input type="text" name="nome" placeholder="Nome do novo núcleo" required style={{ maxWidth: 260 }} />
            <button className="btn" type="submit">Adicionar núcleo</button>
          </form>
        )}
      </div>

      {sel && podeEscrever && (
        <form action={excluirDistribuicao} className="card">
          <input type="hidden" name="id" value={sel.id} />
          <button className="btn perigo mini" type="submit">Excluir “{sel.titulo}”</button>
          <span className="muted"> — apaga também as pré-fichas desta distribuição.</span>
        </form>
      )}
    </>
  );
}
