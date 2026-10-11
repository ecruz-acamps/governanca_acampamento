import { Campo, Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { CARGO_LABEL, DIRETORIA, FISCAL, fmtData, hoje } from '@/lib/format';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { criarCiclo, empossar, encerrarMandato } from './actions';

type Ciclo = { id: string; inicio: string; fim: string };
type Mandato = { id: string; cargo: string; nome: string; inicio: string; fim: string; dias: number };

export default async function MandatosPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePerm('mandatos:ler');
  const podeEscrever = can(u.papel, 'mandatos:escrever');

  const { ciclos, ativos, candidatos } = await run(u.id, async (tx) => {
    const ciclos = await tx<Ciclo[]>`select id, inicio, fim from gov.ciclo_mandato order by inicio desc`;
    const ativos = await tx<Mandato[]>`
      select m.id, m.cargo::text, a.nome, m.inicio, m.fim, (m.fim - current_date)::int as dias
        from gov.mandato m join gov.associado a on a.id = m.associado_id
       where m.situacao = 'ativo' order by a.nome
    `;
    const candidatos = await tx<{ id: string; nome: string; senior: boolean }[]>`
      select id, nome, participou_missao_senior as senior from gov.associado
       where status = 'associado' order by nome
    `;
    return { ciclos, ativos, candidatos };
  });

  const por = (cargo: string) => ativos.filter((m) => m.cargo === cargo);
  const hojeStr = hoje();
  const cicloAtual = ciclos.find((c) => c.inicio <= hojeStr && c.fim >= hojeStr);

  const linha = (cargo: string) => {
    const ms = por(cargo);
    return (
      <tr key={cargo}>
        <td className="muted" style={{ width: '32%' }}>{CARGO_LABEL[cargo]}</td>
        <td>
          {ms.length === 0 ? <Chip tom="warn">vago</Chip> : ms.map((m) => (
            <div key={m.id} className="acoes" style={{ marginBottom: 4 }}>
              <span>{m.nome}</span>
              <span className="muted">até {fmtData(m.fim)}</span>
              {m.dias <= 90 && <Chip tom={m.dias < 0 ? 'bad' : 'warn'}>{m.dias < 0 ? 'vencido' : `${m.dias} dias`}</Chip>}
              {podeEscrever && (
                <form action={encerrarMandato} className="acoes">
                  <input type="hidden" name="id" value={m.id} />
                  <input type="text" name="motivo" placeholder="Motivo" style={{ width: 160 }} />
                  <button className="btn perigo mini" type="submit">Encerrar</button>
                </form>
              )}
            </div>
          ))}
        </td>
      </tr>
    );
  };

  return (
    <>
      <PageHead
        titulo="Mandatos"
        sub={cicloAtual ? `Ciclo atual: ${fmtData(cicloAtual.inicio)} a ${fmtData(cicloAtual.fim)} (3 anos)` : 'Nenhum ciclo vigente cadastrado'}
      />
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      <div className="grid g2">
        <div className="card">
          <h2>Diretoria (Art. 16)</h2>
          <table><tbody>{DIRETORIA.map(linha)}</tbody></table>
        </div>
        <div className="card">
          <h2>Conselho Fiscal (Art. 21)</h2>
          <p className="muted">Até 3 titulares e 3 suplentes.</p>
          <table><tbody>{FISCAL.map(linha)}</tbody></table>
        </div>
      </div>

      {podeEscrever && (
        <div className="grid g2">
          <form action={empossar} className="card">
            <h2>Registrar mandato</h2>
            {ciclos.length === 0 ? <p className="vazio">Crie primeiro um ciclo de 3 anos.</p> : (
              <>
                <div className="form-grid">
                  <Campo label="Ciclo">
                    <select name="ciclo_id" defaultValue={cicloAtual?.id} required>
                      {ciclos.map((c) => <option key={c.id} value={c.id}>{fmtData(c.inicio)} a {fmtData(c.fim)}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Cargo">
                    <select name="cargo" required defaultValue="">
                      <option value="" disabled>Escolha…</option>
                      {[...DIRETORIA, ...FISCAL].map((c) => <option key={c} value={c}>{CARGO_LABEL[c]}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Associado" dica="Diretoria exige missão do Sênior (Art. 16 §1)" className="larga">
                    <select name="associado_id" required defaultValue="">
                      <option value="" disabled>Escolha…</option>
                      {candidatos.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.senior ? '' : ' (sem missão do Sênior)'}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Início (opcional)" dica="Se vazio, começa com o ciclo"><input type="date" name="inicio" /></Campo>
                </div>
                <div style={{ marginTop: 14 }}><button className="btn" type="submit">Registrar</button></div>
              </>
            )}
          </form>

          <div className="card">
            <h2>Ciclos de mandato</h2>
            <form action={criarCiclo} className="acoes" style={{ marginBottom: 12 }}>
              <input type="date" name="inicio" required style={{ width: 170 }} />
              <button className="btn sec" type="submit">Criar ciclo de 3 anos</button>
            </form>
            {ciclos.length === 0 ? <p className="vazio">Nenhum ciclo.</p> : (
              <table><tbody>
                {ciclos.map((c) => (
                  <tr key={c.id}><td>{fmtData(c.inicio)} a {fmtData(c.fim)}</td>
                    <td>{c.inicio <= hojeStr && c.fim >= hojeStr ? <Chip tom="ok">vigente</Chip> : <Chip>{c.fim < hojeStr ? 'encerrado' : 'futuro'}</Chip>}</td></tr>
                ))}
              </tbody></table>
            )}
          </div>
        </div>
      )}
    </>
  );
}
