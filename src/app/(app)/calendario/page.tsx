import { Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { anoAtual, CARGO_LABEL, fmtData } from '@/lib/format';
import { inteiroOuNulo } from '@/lib/form';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { atualizarObrigacao, gerarObrigacoes } from './actions';

type Ob = {
  id: string; titulo: string; base_estatutaria: string; prazo: string; prazo_tipo: string;
  responsavel_cargo: string | null; status: string; cumprida_em: string | null; observacao: string | null;
  dias: number;
};

export default async function CalendarioPage({ searchParams }: { searchParams: SP & { ano?: string } }) {
  const u = await requirePerm('calendario:ler');
  const podeEscrever = can(u.papel, 'calendario:escrever');
  const ano = inteiroOuNulo(searchParams.ano ?? null) ?? anoAtual();

  const obrigacoes = await run(u.id, (tx) => tx<Ob[]>`
    select id, titulo, base_estatutaria, prazo, prazo_tipo, responsavel_cargo::text, status,
           cumprida_em, observacao, (prazo - current_date)::int as dias
      from gov.obrigacao where exercicio = ${ano} order by prazo, titulo
  `);

  return (
    <>
      <PageHead titulo="Calendário de obrigações" sub={`Prazos que o estatuto impõe à Diretoria — exercício ${ano}`}>
        <form method="get" className="acoes">
          <input type="number" name="ano" defaultValue={ano} min={2000} max={2100} style={{ width: 100 }} />
          <button className="btn sec" type="submit">Ver ano</button>
        </form>
        {podeEscrever && (
          <form action={gerarObrigacoes}>
            <input type="hidden" name="ano" value={ano} />
            <button className="btn" type="submit">Gerar obrigações de {ano}</button>
          </form>
        )}
      </PageHead>
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      <div className="card tabela">
        {obrigacoes.length === 0 ? (
          <p className="vazio">Nenhuma obrigação em {ano}. Use “Gerar obrigações”.</p>
        ) : (
          <table>
            <thead><tr><th>Prazo</th><th>Obrigação</th><th>Responsável</th><th>Situação</th>{podeEscrever && <th></th>}</tr></thead>
            <tbody>
              {obrigacoes.map((o) => (
                <tr key={o.id}>
                  <td>{fmtData(o.prazo)}{o.prazo_tipo === 'interno' && <div className="muted">prazo interno</div>}</td>
                  <td>{o.titulo}<div className="muted">{o.base_estatutaria}</div>
                    {o.observacao && <div className="muted">“{o.observacao}”</div>}</td>
                  <td>{o.responsavel_cargo ? CARGO_LABEL[o.responsavel_cargo] : '—'}</td>
                  <td>
                    {o.status === 'cumprida' ? <Chip tom="ok">Cumprida {fmtData(o.cumprida_em)}</Chip>
                      : o.status === 'dispensada' ? <Chip>Dispensada</Chip>
                      : o.dias < 0 ? <Chip tom="bad">Vencida há {-o.dias} d</Chip>
                      : <Chip tom={o.dias <= 30 ? 'warn' : 'mute'}>em {o.dias} d</Chip>}
                  </td>
                  {podeEscrever && (
                    <td>
                      <form action={atualizarObrigacao} className="acoes">
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="ano" value={ano} />
                        {o.status === 'pendente' ? (
                          <>
                            <input type="text" name="observacao" placeholder="Observação" style={{ width: 150 }} />
                            <button className="btn mini" type="submit" name="acao" value="cumprida">Cumprida</button>
                            <button className="btn sec mini" type="submit" name="acao" value="dispensada">Dispensar</button>
                          </>
                        ) : (
                          <button className="btn sec mini" type="submit" name="acao" value="pendente">Reabrir</button>
                        )}
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
