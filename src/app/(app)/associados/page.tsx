import Link from 'next/link';
import { Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { ACAMPAMENTO_LABEL, anoAtual, fmtData, STATUS_LABEL, STATUS_TOM } from '@/lib/format';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';

type Linha = {
  id: string;
  nome: string;
  email: string | null;
  status: string;
  acampamento_tipo: string | null;
  data_admissao: string | null;
  percentual: string | null;
  abaixo: boolean | null;
};

export default async function AssociadosPage({
  searchParams,
}: {
  searchParams: SP & { q?: string; status?: string };
}) {
  const u = await requirePerm('associados:ler');
  const q = (searchParams.q ?? '').trim().slice(0, 80);
  const status = searchParams.status && searchParams.status in STATUS_LABEL ? searchParams.status : '';
  const ano = anoAtual();

  const linhas = await run(u.id, (tx) => tx<Linha[]>`
    select a.id, a.nome, a.email, a.status::text, a.acampamento_tipo::text, a.data_admissao,
           f.percentual::text as percentual, f.abaixo_do_minimo as abaixo
      from gov.associado a
      left join gov.v_frequencia_anual f on f.associado_id = a.id and f.ano = ${ano}
     where true
       ${q ? tx`and (a.nome ilike ${'%' + q + '%'} or a.email ilike ${'%' + q + '%'})` : tx``}
       ${status ? tx`and a.status = ${status}` : tx``}
     order by a.nome
     limit 500
  `);

  return (
    <>
      <PageHead titulo="Associados" sub="Cadastro, requisitos de admissão (Art. 6) e frequência (Art. 7, j)">
        {can(u.papel, 'associados:escrever') && (
          <Link className="btn" href="/associados/novo">Novo cadastro</Link>
        )}
      </PageHead>
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      <form className="filtros" method="get">
        <input type="text" name="q" placeholder="Buscar por nome ou e-mail" defaultValue={q} />
        <select name="status" defaultValue={status}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className="btn sec" type="submit">Filtrar</button>
      </form>

      <div className="card tabela">
        {linhas.length === 0 ? (
          <p className="vazio">Nenhum cadastro encontrado.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Nome</th><th>Status</th><th>Acampamento</th><th>Admissão</th><th>Frequência {ano}</th></tr>
            </thead>
            <tbody>
              {linhas.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/associados/${a.id}`}>{a.nome}</Link>
                    {a.email && <div className="muted">{a.email}</div>}
                  </td>
                  <td><Chip tom={STATUS_TOM[a.status]}>{STATUS_LABEL[a.status]}</Chip></td>
                  <td>{a.acampamento_tipo ? ACAMPAMENTO_LABEL[a.acampamento_tipo] : '—'}</td>
                  <td>{fmtData(a.data_admissao)}</td>
                  <td>
                    {a.percentual == null ? <span className="muted">—</span>
                      : <Chip tom={a.abaixo ? 'bad' : 'ok'}>{a.percentual}%</Chip>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
