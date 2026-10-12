import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { CARGO_LABEL } from '@/lib/format';
import { isUuid } from '@/lib/form';
import { requireAssociado } from '@/lib/session';
import { votar } from '../../../eleicoes/actions';

export default async function VotarPage({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const u = await requireAssociado();
  if (!isUuid(params.id)) notFound();
  const r = await run(u.id, async (tx) => {
    const [e] = await tx<{ ano: number; status: string }[]>`select ano, status from gov.eleicao where id = ${params.id}`;
    if (!e) return null;
    const [{ rod }] = await tx<{ rod: number }[]>`select gov.rodada_atual(${params.id}::uuid) as rod`;
    const cands = await tx<{ id: string; nome: string; cargo: string }[]>`
      select c.id, a.nome, c.cargo::text from gov.candidatura c join gov.associado a on a.id = c.associado_id
       where c.eleicao_id = ${params.id} and c.rodada = ${rod} and c.resultado = 'pendente' order by c.cargo, a.nome
    `;
    const [{ ja }] = await tx<{ ja: boolean }[]>`
      select exists (select 1 from gov.eleitor_participacao where eleicao_id = ${params.id} and rodada = ${rod} and associado_id = ${u.associadoId}) as ja
    `;
    const [{ ativo }] = await tx<{ ativo: boolean }[]>`select (status = 'associado') as ativo from gov.associado where id = ${u.associadoId}`;
    return { e, cands, ja, ativo };
  });
  if (!r) notFound();
  const aberta = r.e.status === 'votacao';

  return (
    <>
      <PageHead titulo={`Eleição ${r.e.ano}`} sub="Voto secreto: ninguém consegue ver como você votou">
        <Link className="btn sec" href="/portal">Voltar</Link>
      </PageHead>
      <Flash ok={searchParams.ok} erro={searchParams.erro} />
      {!aberta && <p className="vazio">A votação não está aberta.</p>}
      {aberta && !r.ativo && <p className="vazio">Só associados ativos podem votar.</p>}
      {aberta && r.ativo && r.ja && <div className="flash ok">Seu voto desta rodada já foi registrado. Obrigado!</div>}
      {aberta && r.ativo && !r.ja && (
        <form action={votar} className="card">
          <input type="hidden" name="id" value={params.id} />
          <input type="hidden" name="retorno" value={`/portal/votar/${params.id}`} />
          <p className="muted">Responda para todos os candidatos. Depois de confirmar, não dá para mudar.</p>
          {r.cands.map((c) => (
            <fieldset key={c.id} style={{ margin: '14px 0' }}>
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
    </>
  );
}
