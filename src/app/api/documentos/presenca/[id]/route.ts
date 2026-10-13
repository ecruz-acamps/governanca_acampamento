import { guardaDoc } from '@/lib/docauth';
import { run } from '@/lib/db';
import { fmtData, REUNIAO_LABEL } from '@/lib/format';
import { Doc, respostaPdf } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

/** Lista de presença para impressão. ?t=assembleia (padrão: reunião). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const assembleia = new URL(req.url).searchParams.get('t') === 'assembleia';
  const g = await guardaDoc(assembleia ? 'assembleias:ler' : 'reunioes:ler', params.id);
  if ('erro' in g) return g.erro;

  let titulo: string, sub: string, data: string, linhas: { nome: string; presente: boolean | null }[];
  if (assembleia) {
    const r = await run(g.u.id, async (tx) => {
      const [a] = await tx<{ titulo: string; tipo: string; data_realizacao: string }[]>`select titulo, tipo::text, data_realizacao from gov.assembleia where id = ${params.id}`;
      if (!a) return null;
      const l = await tx<{ nome: string; presente: boolean | null }[]>`
        select s.nome, (p.associado_id is not null) as presente from gov.associado s
          left join gov.assembleia_presenca p on p.assembleia_id = ${params.id} and p.associado_id = s.id
         where p.associado_id is not null or (s.status = 'associado' and s.data_admissao <= ${a.data_realizacao})
         order by s.nome`;
      return { a, l };
    });
    if (!r) return new Response('Assembleia não encontrada', { status: 404 });
    titulo = r.a.titulo; data = r.a.data_realizacao; sub = `${r.a.tipo === 'AGO' ? 'Assembleia Geral Ordinária' : 'Assembleia Geral Extraordinária'} · ${fmtData(data)}`;
    linhas = r.l;
  } else {
    const r = await run(g.u.id, async (tx) => {
      const [m] = await tx<{ titulo: string | null; tipo: string; data: string; local: string | null }[]>`select titulo, tipo::text, data, local from gov.reuniao where id = ${params.id}`;
      if (!m) return null;
      const l = await tx<{ nome: string; presente: boolean | null }[]>`
        select a.nome, p.presente from gov.associado a
          left join gov.presenca p on p.reuniao_id = ${params.id} and p.associado_id = a.id
         where p.associado_id is not null
            or (a.status in ('associado','suspenso') and a.data_admissao <= ${m.data} and (a.data_saida is null or a.data_saida >= ${m.data}))
         order by a.nome`;
      return { m, l };
    });
    if (!r) return new Response('Reunião não encontrada', { status: 404 });
    titulo = r.m.titulo ?? REUNIAO_LABEL[r.m.tipo]; data = r.m.data;
    sub = `${REUNIAO_LABEL[r.m.tipo]} · ${fmtData(data)}${r.m.local ? ' · ' + r.m.local : ''}`;
    linhas = r.l;
  }
  const d = await Doc.criar(`Lista de presença - ${titulo}`, `Lista de presença · ${titulo}`);
  d.cabecalho();
  d.titulo1('Lista de presença');
  d.p(titulo, { negrito: true, depois: 2 });
  d.p(sub, { depois: 10 });
  d.tabela(['Nº', 'Nome', 'Presente', 'Assinatura'], linhas.map((l, i) => [String(i + 1), l.nome, l.presente === null ? '' : l.presente ? 'Sim' : 'Não', '']), [0.07, 0.43, 0.12, 0.38]);
  d.p(`Total de associados na lista: ${linhas.length}.`, { tam: 10 });
  return respostaPdf(await d.bytes(), `presenca-${data}.pdf`);
}
