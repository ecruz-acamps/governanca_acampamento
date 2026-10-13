import { guardaDoc, ocupante } from '@/lib/docauth';
import { run } from '@/lib/db';
import { fmtData, fmtMoeda, ORIGEM_LABEL, PRESTACAO_TIPO_LABEL } from '@/lib/format';
import { Doc, respostaPdf } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

type P = { tipo: string; exercicio: number; periodo_inicio: string; periodo_fim: string; status: string; parecer_cf_em: string | null; parecer_cf_resultado: string | null; parecer_cf_texto: string | null };
type L = { data: string; tipo: string; categoria: string | null; descricao: string; valor: string; origem: string; comprovado: boolean };

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const g = await guardaDoc('financeiro:ler', params.id);
  if ('erro' in g) return g.erro;
  const r = await run(g.u.id, async (tx) => {
    const [p] = await tx<P[]>`select tipo, exercicio, periodo_inicio, periodo_fim, status, parecer_cf_em, parecer_cf_resultado, parecer_cf_texto from gov.prestacao_contas where id = ${params.id}`;
    if (!p) return null;
    const ls = await tx<L[]>`
      select data, tipo, categoria, descricao, valor::text, origem::text, (comprovante_documento_id is not null) as comprovado
        from gov.lancamento
       where data between ${p.periodo_inicio} and ${p.periodo_fim}
         ${p.tipo === 'trimestral_verba_publica' ? tx`and origem in ('verba_publica','convenio')` : tx``}
       order by data, criado_em`;
    return { p, ls };
  });
  if (!r) return new Response('Prestação não encontrada', { status: 404 });
  const { p, ls } = r;
  const tesoureiro = (await ocupante(g.u.id, 'tesoureiro')) ?? 'Tesoureiro(a)';
  const presidente = (await ocupante(g.u.id, 'presidente')) ?? 'Presidente';
  const soma = (t: string) => ls.filter((l) => l.tipo === t).reduce((a, l) => a + Number(l.valor), 0);
  const rec = soma('receita'), desp = soma('despesa');

  const d = await Doc.criar(PRESTACAO_TIPO_LABEL[p.tipo], `${PRESTACAO_TIPO_LABEL[p.tipo]} · ${fmtData(p.periodo_inicio)} a ${fmtData(p.periodo_fim)}`);
  d.cabecalho();
  d.titulo1(PRESTACAO_TIPO_LABEL[p.tipo]);
  d.p(`Período: ${fmtData(p.periodo_inicio)} a ${fmtData(p.periodo_fim)} (exercício ${p.exercicio}).`);
  d.sub('Resumo');
  d.tabela(['Item', 'Valor'], [['Total de receitas', fmtMoeda(rec)], ['Total de despesas', fmtMoeda(desp)], ['Saldo do período', fmtMoeda(rec - desp)]], [0.7, 0.3], { direita: [1] });
  const origens = [...new Set(ls.map((l) => l.origem))];
  if (origens.length) {
    d.sub('Por origem do recurso');
    d.tabela(['Origem', 'Receitas', 'Despesas'], origens.map((o) => {
      const s = (t: string) => ls.filter((l) => l.origem === o && l.tipo === t).reduce((a, l) => a + Number(l.valor), 0);
      return [ORIGEM_LABEL[o] ?? o, fmtMoeda(s('receita')), fmtMoeda(s('despesa'))];
    }), [0.5, 0.25, 0.25], { direita: [1, 2] });
  }
  d.sub(`Lançamentos (${ls.length})`);
  if (ls.length) {
    d.tabela(['Data', 'Tipo', 'Descrição', 'Origem', 'Valor', 'Comprov.'],
      ls.map((l) => [fmtData(l.data), l.tipo === 'receita' ? 'Receita' : 'Despesa', l.descricao + (l.categoria ? ` (${l.categoria})` : ''), ORIGEM_LABEL[l.origem] ?? l.origem, fmtMoeda(l.valor), l.comprovado ? 'Sim' : 'Não']),
      [0.12, 0.1, 0.36, 0.14, 0.16, 0.12], { direita: [4] });
  } else d.p('Nenhum lançamento no período.');
  d.sub('Parecer do Conselho Fiscal (Art. 22)');
  if (p.parecer_cf_em) {
    d.p(`Em ${fmtData(p.parecer_cf_em)}: ${p.parecer_cf_resultado ?? ''}.`);
    if (p.parecer_cf_texto) d.p(p.parecer_cf_texto);
  } else d.p('Parecer ainda não emitido.');
  d.assinaturas([{ nome: tesoureiro, cargo: 'Tesoureiro(a)' }, { nome: presidente, cargo: 'Presidente' }, { nome: '____________________', cargo: 'Conselho Fiscal' }]);
  return respostaPdf(await d.bytes(), `${p.tipo}-${p.exercicio}.pdf`);
}
