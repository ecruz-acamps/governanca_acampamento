import { guardaDoc, ocupante } from '@/lib/docauth';
import { run } from '@/lib/db';
import { CONVOCADA_POR_LABEL, fmtData, MATERIA_LABEL } from '@/lib/format';
import { Doc, respostaPdf } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

type A = { tipo: string; titulo: string; convocada_por: string; data_convocacao: string; data_realizacao: string; canais_divulgacao: string[] | null; convocacao_numero: number };

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const g = await guardaDoc('assembleias:ler', params.id);
  if ('erro' in g) return g.erro;
  const { a, mat } = await run(g.u.id, async (tx) => {
    const [a] = await tx<A[]>`select tipo::text, titulo, convocada_por, data_convocacao, data_realizacao, canais_divulgacao, convocacao_numero from gov.assembleia where id = ${params.id}`;
    const mat = a ? await tx<{ materia: string; descricao: string }[]>`select materia::text, descricao from gov.deliberacao where assembleia_id = ${params.id} order by criado_em` : [];
    return { a, mat };
  });
  if (!a) return new Response('Assembleia não encontrada', { status: 404 });
  const presidente = (await ocupante(g.u.id, 'presidente')) ?? 'Presidente';
  const secretario = (await ocupante(g.u.id, 'secretario')) ?? 'Secretário(a)';

  const ago = a.tipo === 'AGO';
  const d = await Doc.criar(`Edital - ${a.titulo}`, `Edital de convocação · ${a.titulo}`);
  d.cabecalho('Entidade vinculada à Paróquia · Estatuto: Segundo Instrumento de Alteração (26/08/2023)');
  d.titulo1(`Edital de Convocação - ${ago ? 'Assembleia Geral Ordinária' : 'Assembleia Geral Extraordinária'}`);
  d.p(`${a.titulo}`, { negrito: true });
  d.p(
    `${CONVOCADA_POR_LABEL[a.convocada_por] ?? a.convocada_por} da ${'Associação dos Campistas São Padre Pio'} convoca todos os associados para a ` +
    `${ago ? 'Assembleia Geral Ordinária (AGO)' : 'Assembleia Geral Extraordinária (AGE)'}, a realizar-se em ${fmtData(a.data_realizacao)}, ` +
    `conforme as informações abaixo.`,
  );
  d.p('Data: ' + fmtData(a.data_realizacao) + '\nHorário: ____ h ____ min\nLocal: ______________________________________________', { depois: 8 });
  d.sub('Convocações e quórum');
  if (ago) {
    d.p('1ª convocação: com a presença de metade mais um dos associados (Art. 11, parágrafo único).\n2ª convocação: meia hora depois, com qualquer número de associados.');
  } else {
    d.p('1ª convocação: com a presença da maioria absoluta dos associados.\n2ª convocação: meia hora depois, com 1/3 dos associados.\n3ª convocação: com, no mínimo, 10% dos associados (Art. 13, I).');
  }
  d.p(`Esta é a ${a.convocacao_numero}ª convocação. Convocação publicada em ${fmtData(a.data_convocacao)}.`);
  d.sub('Ordem do dia');
  if (mat.length) mat.forEach((m, i) => d.p(`${i + 1}. ${MATERIA_LABEL[m.materia] ?? m.materia}: ${m.descricao}`, { depois: 2 }));
  else if (ago) {
    d.item('Aprovação das contas, balanços e relatórios (Art. 11, I);');
    d.item('Eleição e posse da Diretoria e do Conselho Fiscal, a cada 3 anos (Art. 11, II);');
    d.item('Propostas de dinamização da Associação (Art. 11, III);');
    d.item('Assuntos de interesse da Associação (Art. 11, IV).');
  } else {
    d.p('1. ______________________________________________\n2. ______________________________________________\n3. ______________________________________________');
  }
  d.sub('Divulgação');
  d.p(`Este edital é divulgado por: ${(a.canais_divulgacao ?? []).join(', ') || 'reuniões mensais, convites aos sócios e divulgação nas missas das comunidades'}, ${ago ? '' : 'com antecedência mínima de 30 dias (Art. 13, II)'}.`.replace(', .', '.'));
  d.p(`Local e data: ____________________, ${fmtData(a.data_convocacao)}.`);
  d.assinaturas([{ nome: presidente, cargo: 'Presidente' }, { nome: secretario, cargo: 'Secretário(a)' }]);
  return respostaPdf(await d.bytes(), `edital-${a.data_realizacao}.pdf`);
}
