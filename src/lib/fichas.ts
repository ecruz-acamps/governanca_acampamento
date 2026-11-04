export type NucleoEntrada = {
  id: string;
  nome: string;
  tipo: 'nucleo' | 'cortesia';
  fichasFixas: number | null;
  fichasMinimas?: number | null; // piso: entra na divisão proporcional, mas nunca recebe menos que isso
  preFichas: number;
};

export type LinhaFichas = NucleoEntrada & {
  fichas: number;
  percentual: number | null; // % das pré-fichas dos núcleos proporcionais
  modo: 'fixo' | 'cortesia' | 'proporcional' | 'minimo';
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
 * Núcleo com mínimo: se a parte proporcional ficaria abaixo do mínimo, recebe o mínimo,
 * sai da divisão e o resto é refeito para os demais (repete até ninguém ficar abaixo do piso).
 * Empate no resto: quem tem mais pré-fichas, depois ordem alfabética.
 */
export function distribuirFichas(total: number, entradas: NucleoEntrada[]): Distribuicao {
  const fixos = entradas.reduce((a, n) => a + (n.fichasFixas ?? 0), 0);
  const restante = total - fixos;
  const prop = entradas.filter((n) => n.fichasFixas === null);
  const somaPre = prop.reduce((a, n) => a + n.preFichas, 0);

  const fichas = new Map<string, number>();
  const porMinimo = new Set<string>();
  for (const n of entradas) if (n.fichasFixas !== null) fichas.set(n.id, n.fichasFixas);

  let erro: string | null = null;
  if (restante < 0) {
    erro = `As fichas fixas (${fixos}) são maiores que o total (${total}).`;
    for (const n of prop) fichas.set(n.id, 0);
  } else {
    let pool = [...prop];
    let resto = restante;
    for (;;) {
      const soma = pool.reduce((a, n) => a + n.preFichas, 0);
      const abaixo = pool.filter((n) => (n.fichasMinimas ?? 0) > 0 && (soma > 0 ? (resto * n.preFichas) / soma : 0) < (n.fichasMinimas ?? 0));
      if (abaixo.length === 0) break;
      for (const n of abaixo) {
        fichas.set(n.id, n.fichasMinimas ?? 0);
        porMinimo.add(n.id);
        resto -= n.fichasMinimas ?? 0;
      }
      pool = pool.filter((n) => !porMinimo.has(n.id));
    }
    const soma = pool.reduce((a, n) => a + n.preFichas, 0);
    if (resto < 0) {
      erro = `Os mínimos e as fichas fixas (${total - resto}) são maiores que o total (${total}).`;
      for (const n of pool) fichas.set(n.id, 0);
    } else if (soma === 0) {
      for (const n of pool) fichas.set(n.id, 0);
      if (pool.length && resto > 0) erro = 'Informe as pré-fichas dos núcleos para calcular a divisão.';
    } else {
      const cotas = pool.map((n) => {
        const exato = (resto * n.preFichas) / soma;
        return { n, base: Math.floor(exato), resto: exato - Math.floor(exato) };
      });
      let sobra = resto - cotas.reduce((a, c) => a + c.base, 0);
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
  }

  const linhas: LinhaFichas[] = entradas.map((n) => ({
    ...n,
    fichas: fichas.get(n.id) ?? 0,
    percentual: n.fichasFixas === null && !porMinimo.has(n.id) && somaPre > 0 ? (n.preFichas / somaPre) * 100 : null,
    modo: n.fichasFixas === null ? (porMinimo.has(n.id) ? 'minimo' : 'proporcional') : n.tipo === 'cortesia' ? 'cortesia' : 'fixo',
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

/**
 * Pré-fichas que entram na divisão: as de dentro valem 1; as de fora da Arquidiocese valem `peso` (0 a 1).
 * Só vale para núcleos que separam dentro/fora; nos demais, só as pré-fichas normais contam.
 */
export function preEfetivas(pre: number, fora: number, separaOrigem: boolean, peso: number): number {
  const p = Math.min(1, Math.max(0, peso));
  return Math.round((pre + (separaOrigem ? fora * p : 0)) * 10000) / 10000;
}
