export type NucleoEntrada = {
  id: string;
  nome: string;
  tipo: 'nucleo' | 'cortesia';
  fichasFixas: number | null;
  preFichas: number;
};

export type LinhaFichas = NucleoEntrada & {
  fichas: number;
  percentual: number | null; // % das pré-fichas dos núcleos proporcionais
  modo: 'fixo' | 'cortesia' | 'proporcional';
};

export type Distribuicao = {
  linhas: LinhaFichas[];
  fixos: number;
  restante: number;
  somaPre: number;
  erro: string | null;
};

/**
 * Fixos e cortesia saem primeiro; o restante é dividido pelas pré-fichas
 * (método do maior resto, para a soma fechar exatamente no total).
 * Empate no resto: quem tem mais pré-fichas, depois ordem alfabética.
 */
export function distribuirFichas(total: number, entradas: NucleoEntrada[]): Distribuicao {
  const fixos = entradas.reduce((a, n) => a + (n.fichasFixas ?? 0), 0);
  const restante = total - fixos;
  const prop = entradas.filter((n) => n.fichasFixas === null);
  const somaPre = prop.reduce((a, n) => a + n.preFichas, 0);

  const fichas = new Map<string, number>();
  for (const n of entradas) if (n.fichasFixas !== null) fichas.set(n.id, n.fichasFixas);

  let erro: string | null = null;
  if (restante < 0) {
    erro = `As fichas fixas (${fixos}) são maiores que o total (${total}).`;
    for (const n of prop) fichas.set(n.id, 0);
  } else if (somaPre === 0) {
    for (const n of prop) fichas.set(n.id, 0);
    if (prop.length && restante > 0) erro = 'Informe as pré-fichas dos núcleos para calcular a divisão.';
  } else {
    const cotas = prop.map((n) => {
      const exato = (restante * n.preFichas) / somaPre;
      return { n, base: Math.floor(exato), resto: exato - Math.floor(exato) };
    });
    let sobra = restante - cotas.reduce((a, c) => a + c.base, 0);
    const ordem = [...cotas].sort(
      (x, y) => y.resto - x.resto || y.n.preFichas - x.n.preFichas || x.n.nome.localeCompare(y.n.nome, 'pt-BR'),
    );
    for (const c of ordem) {
      if (sobra <= 0) break;
      c.base += 1;
      sobra -= 1;
    }
    for (const c of cotas) fichas.set(c.n.id, c.base);
  }

  const linhas: LinhaFichas[] = entradas.map((n) => ({
    ...n,
    fichas: fichas.get(n.id) ?? 0,
    percentual: n.fichasFixas === null && somaPre > 0 ? (n.preFichas / somaPre) * 100 : null,
    modo: n.fichasFixas === null ? 'proporcional' : n.tipo === 'cortesia' ? 'cortesia' : 'fixo',
  }));
  return { linhas, fixos, restante, somaPre, erro };
}

export type Faixa = { chave: string; nome: string; qtd: number; de: number; ate: number; reserva: boolean };

/**
 * Numeração contínua das fichas: núcleos em ordem alfabética, depois a cortesia, e a reserva por último.
 * Quem fica com 0 fichas não recebe faixa.
 */
export function faixasFichas(linhas: LinhaFichas[], reserva: number, inicio: number): Faixa[] {
  const ordem = [...linhas]
    .filter((l) => l.fichas > 0)
    .sort((a, b) => Number(a.modo === 'cortesia') - Number(b.modo === 'cortesia') || a.nome.localeCompare(b.nome, 'pt-BR'));
  const itens = ordem.map((l) => ({ chave: l.id, nome: l.nome, qtd: l.fichas, reserva: false }));
  if (reserva > 0) itens.push({ chave: 'reserva', nome: 'Reserva (emergência e padres)', qtd: reserva, reserva: true });
  let prox = inicio;
  return itens.map((i) => {
    const f = { ...i, de: prox, ate: prox + i.qtd - 1 };
    prox += i.qtd;
    return f;
  });
}

/** Máximo de fichas por ZIP (a Vercel limita a resposta a 4,5 MB; cada ficha pesa ~150 KB). */
export const FICHAS_POR_ZIP = 20;

/** Divide uma faixa em partes de até FICHAS_POR_ZIP fichas. */
export function partesDaFaixa(f: Faixa): { parte: number; de: number; ate: number }[] {
  const partes: { parte: number; de: number; ate: number }[] = [];
  for (let de = f.de, i = 0; de <= f.ate; de += FICHAS_POR_ZIP, i++) partes.push({ parte: i, de, ate: Math.min(f.ate, de + FICHAS_POR_ZIP - 1) });
  return partes;
}
