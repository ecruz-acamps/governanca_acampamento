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
