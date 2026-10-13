import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { fmtData, REUNIAO_LABEL } from '@/lib/format';
import { isUuid } from '@/lib/form';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { excluirReuniao, salvarPresenca } from '../actions';

type Reuniao = {
  id: string; tipo: string; data: string; titulo: string | null; local: string | null;
  pauta: string | null; conta_presenca: boolean;
};
type Linha = { id: string; nome: string; presente: boolean | null; justificativa: string | null };

export default async function ReuniaoPage({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const u = await requirePerm('reunioes:ler');
  if (!isUuid(params.id)) notFound();
  const podeEscrever = can(u.papel, 'reunioes:escrever');

  const r = await run(u.id, async (tx) => {
    const [reuniao] = await tx<Reuniao[]>`
      select id, tipo::text, data, titulo, local, pauta, conta_presenca from gov.reuniao where id = ${params.id}
    `;
    if (!reuniao) return null;
    // Quem podia estar na reunião: associados admitidos até a data (ou que já têm registro)
    const linhas = await tx<Linha[]>`
      select a.id, a.nome, p.presente, p.justificativa
        from gov.associado a
        left join gov.presenca p on p.reuniao_id = ${params.id} and p.associado_id = a.id
       where p.associado_id is not null
          or (a.status in ('associado','suspenso') and a.data_admissao <= ${reuniao.data}
              and (a.data_saida is null or a.data_saida >= ${reuniao.data}))
       order by a.nome
    `;
    return { reuniao, linhas };
  });
  if (!r) notFound();
  const { reuniao, linhas } = r;
  const semRegistro = linhas.every((l) => l.presente === null);

  return (
    <>
      <PageHead
        titulo={reuniao.titulo ?? REUNIAO_LABEL[reuniao.tipo]}
        sub={`${REUNIAO_LABEL[reuniao.tipo]} · ${fmtData(reuniao.data)}${reuniao.local ? ' · ' + reuniao.local : ''}`}
      >
        {!reuniao.conta_presenca && <Chip>Não conta para os 75%</Chip>}
        <a className="btn sec" href={`/api/documentos/presenca/${reuniao.id}`} target="_blank" rel="noreferrer">Lista de presença (PDF)</a>
        <Link className="btn sec" href="/reunioes">Voltar</Link>
      </PageHead>
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      {reuniao.pauta && <div className="card"><h3>Pauta</h3><p style={{ whiteSpace: 'pre-wrap' }}>{reuniao.pauta}</p></div>}

      <form action={salvarPresenca} className="card tabela">
        <h2>Lista de presença</h2>
        <input type="hidden" name="reuniao_id" value={reuniao.id} />
        {linhas.length === 0 ? (
          <p className="vazio">Nenhum associado ativo na data desta reunião.</p>
        ) : (
          <fieldset disabled={!podeEscrever}>
            <table>
              <thead><tr><th>Presente</th><th>Associado</th><th>Justificativa (se ausente)</th></tr></thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <input type="hidden" name="assoc" value={l.id} />
                      <input type="checkbox" name={`p_${l.id}`} defaultChecked={l.presente ?? false} aria-label={`Presença de ${l.nome}`} />
                    </td>
                    <td>{l.nome}</td>
                    <td><input type="text" name={`j_${l.id}`} defaultValue={l.justificativa ?? ''} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {podeEscrever && (
              <div style={{ marginTop: 14 }}>
                <button className="btn" type="submit">{semRegistro ? 'Salvar presenças' : 'Atualizar presenças'}</button>
              </div>
            )}
          </fieldset>
        )}
      </form>

      {podeEscrever && (
        <form action={excluirReuniao} className="card">
          <input type="hidden" name="id" value={reuniao.id} />
          <button className="btn perigo mini" type="submit">Excluir esta reunião</button>
          <span className="muted"> — apaga também a lista de presença.</span>
        </form>
      )}
    </>
  );
}
