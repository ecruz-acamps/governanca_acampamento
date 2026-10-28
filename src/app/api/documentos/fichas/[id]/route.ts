import fs from 'node:fs';
import path from 'node:path';
import { guardaDoc } from '@/lib/docauth';
import { run } from '@/lib/db';
import { distribuirFichas, faixasFichas, type NucleoEntrada } from '@/lib/fichas';
import { gerarFichasPdf, textoPeriodo, validarEntrada } from '@/lib/fichaPdf';
import { respostaPdf } from '@/lib/pdf';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type D = {
  titulo: string; total_fichas: number; reserva_fichas: number; ficha_missao_numero: string | null; ficha_saida: string | null;
  ficha_encerramento: string | null; ficha_valor: string | null; ficha_pix: string | null; ficha_contato: string | null; ficha_inicio: number;
};

/** Fichas de inscrição em PDF. ?n=<id do núcleo> | reserva | todas (padrão). Mesmo acesso da tela de fichas. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await guardaDoc('fichas:ler', params.id);
  if ('erro' in g) return g.erro;
  const n = new URL(req.url).searchParams.get('n') ?? 'todas';

  const r = await run(g.u.id, async (tx) => {
    const [d] = await tx<D[]>`
      select titulo, total_fichas, reserva_fichas, ficha_missao_numero, ficha_saida::text, ficha_encerramento::text, ficha_valor::text,
             ficha_pix, ficha_contato, ficha_inicio
        from gov.distribuicao_fichas where id = ${params.id}`;
    if (!d) return null;
    const nucleos = await tx<{ id: string; nome: string; tipo: 'nucleo' | 'cortesia'; fichas_fixas: number | null; pre: number; fora: number; separa_origem: boolean }[]>`
      select n.id, n.nome, n.tipo, n.fichas_fixas, n.separa_origem, coalesce(p.pre_fichas, 0) as pre, coalesce(p.pre_fora, 0) as fora
        from gov.nucleo n left join gov.distribuicao_pre p on p.nucleo_id = n.id and p.distribuicao_id = ${params.id}
       where n.ativo`;
    return { d, nucleos };
  });
  if (!r) return new Response('Distribuição não encontrada', { status: 404 });
  const { d, nucleos } = r;

  const opcoes = {
    missao: d.ficha_missao_numero ?? '',
    data: d.ficha_saida && d.ficha_encerramento ? textoPeriodo(d.ficha_saida, d.ficha_encerramento) : '',
    saida: d.ficha_saida ?? '',
    encerramento: d.ficha_encerramento ?? '',
    valor: Number(d.ficha_valor ?? 0),
    pix: d.ficha_pix ?? '',
    contato: d.ficha_contato ?? '',
  };
  const erro = validarEntrada(opcoes);
  if (erro) return new Response('Preencha os dados das fichas (nº da missão, datas, valor, PIX e contato) antes de gerar.', { status: 400 });

  const entradas: NucleoEntrada[] = nucleos.map((x) => ({
    id: x.id, nome: x.nome, tipo: x.tipo, fichasFixas: x.fichas_fixas, preFichas: x.pre + (x.separa_origem ? x.fora : 0),
  }));
  const calc = distribuirFichas(d.total_fichas, entradas);
  const faixas = faixasFichas(calc.linhas, d.reserva_fichas, d.ficha_inicio);
  const escolhidas = n === 'todas' ? faixas : faixas.filter((f) => f.chave === n);
  if (escolhidas.length === 0) return new Response('Núcleo sem fichas nesta distribuição', { status: 404 });

  const numeros = escolhidas.flatMap((f) => Array.from({ length: f.qtd }, (_, i) => f.de + i));
  const modelo = new Uint8Array(fs.readFileSync(path.join(process.cwd(), 'src/assets/ficha-modelo.pdf')));
  const bytes = await gerarFichasPdf(modelo, opcoes, numeros);
  const pad = (x: number) => String(x).padStart(3, '0');
  const rotulo = n === 'todas' ? 'todas' : escolhidas[0].nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return respostaPdf(bytes, `fichas-${rotulo}-${pad(numeros[0])}-a-${pad(numeros[numeros.length - 1])}.pdf`);
}
