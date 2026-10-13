import { guardaDoc, ocupante } from '@/lib/docauth';
import { run } from '@/lib/db';
import { fmtData, MATERIA_LABEL } from '@/lib/format';
import { Doc, respostaPdf } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

type A = { tipo: string; titulo: string; data_realizacao: string; convocacao_numero: number; associados_aptos: number | null; presentes: number | null; status: string; quorum_ok: boolean };
type D = { materia: string; descricao: string; votos_favor: number; votos_contra: number; abstencoes: number; voto_qualidade: boolean; resultado: string | null };

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const g = await guardaDoc('assembleias:ler', params.id);
  if ('erro' in g) return g.erro;
  const r = await run(g.u.id, async (tx) => {
    const [a] = await tx<A[]>`
      select tipo::text, titulo, data_realizacao, convocacao_numero, associados_aptos, presentes, status,
             gov.quorum_instalacao(tipo, convocacao_numero, coalesce(associados_aptos,0), coalesce(presentes,0)) as quorum_ok
        from gov.assembleia where id = ${params.id}`;
    if (!a) return null;
    const pres = await tx<{ nome: string; modalidade: string }[]>`
      select s.nome, p.modalidade from gov.assembleia_presenca p join gov.associado s on s.id = p.associado_id
       where p.assembleia_id = ${params.id} order by s.nome`;
    const dels = await tx<D[]>`
      select materia::text, descricao, votos_favor, votos_contra, abstencoes, voto_qualidade, resultado
        from gov.deliberacao where assembleia_id = ${params.id} order by criado_em`;
    return { a, pres, dels };
  });
  if (!r) return new Response('Assembleia não encontrada', { status: 404 });
  const { a, pres, dels } = r;
  if (!['instalada', 'realizada'].includes(a.status)) {
    return new Response('A ata só pode ser gerada depois que a assembleia for instalada.', { status: 409 });
  }
  const presidente = (await ocupante(g.u.id, 'presidente')) ?? 'Presidente';
  const secretario = (await ocupante(g.u.id, 'secretario')) ?? 'Secretário(a)';
  const ago = a.tipo === 'AGO';

  const d = await Doc.criar(`Ata - ${a.titulo}`, `Ata · ${a.titulo}`);
  d.cabecalho();
  d.titulo1(`Ata da ${ago ? 'Assembleia Geral Ordinária' : 'Assembleia Geral Extraordinária'}`);
  d.p(
    `Aos ${fmtData(a.data_realizacao)}, em ${a.convocacao_numero}ª convocação, reuniu-se a ${ago ? 'Assembleia Geral Ordinária' : 'Assembleia Geral Extraordinária'} ` +
    `da Associação dos Campistas São Padre Pio, "${a.titulo}", no local previamente divulgado: ____________________. ` +
    `Estavam presentes ${a.presentes ?? pres.length} de ${a.associados_aptos ?? '—'} associados aptos, ` +
    `${a.quorum_ok ? 'atingido o quórum de instalação previsto no estatuto' : 'sem o quórum de instalação previsto no estatuto'}. ` +
    `${presidente} presidiu os trabalhos e ${secretario} secretariou.`,
  );
  d.sub('Deliberações');
  if (!dels.length) d.p('Não houve deliberações registradas.');
  dels.forEach((x, i) => {
    d.p(`${i + 1}. ${MATERIA_LABEL[x.materia] ?? x.materia}`, { negrito: true, depois: 2 });
    d.p(x.descricao, { recuo: 12, depois: 2 });
    d.p(
      `Votos: ${x.votos_favor} a favor, ${x.votos_contra} contra, ${x.abstencoes} abstenções. ` +
      `Resultado: ${x.resultado ?? 'não registrado'}${x.voto_qualidade ? ' (decidido pelo voto de qualidade do Presidente, Art. 15)' : ''}.`,
      { recuo: 12 },
    );
  });
  d.p('Nada mais havendo a tratar, foi encerrada a assembleia, e lavrada a presente ata, que vai assinada pelo Presidente e pelo Secretário.');
  d.assinaturas([{ nome: presidente, cargo: 'Presidente' }, { nome: secretario, cargo: 'Secretário(a)' }]);
  d.sub(`Associados presentes (${pres.length})`);
  d.tabela(['Nome', 'Modalidade', 'Assinatura'], pres.map((p) => [p.nome, p.modalidade === 'remota' ? 'Remota' : 'Presencial', '']), [0.45, 0.17, 0.38]);
  return respostaPdf(await d.bytes(), `ata-${a.data_realizacao}.pdf`);
}
