/**
 * Integração com o outro sistema que guarda as pré-fichas de cada núcleo.
 * Contrato em docs/api-pre-fichas.md. A URL e o token ficam só nas variáveis de ambiente.
 */

export type ItemExterno = { codigo: string | null; nome: string | null; pre_fichas: number; pre_fora: number };
export type RespostaApi =
  | { ok: true; itens: ItemExterno[]; atualizadoEm: string | null }
  | { ok: false; erro: string };

export function apiConfigurada(): { url: string | null; token: boolean } {
  return { url: process.env.PREFICHAS_API_URL?.trim() || null, token: !!process.env.PREFICHAS_API_TOKEN };
}

/** Minúsculas, sem acento, travessões iguais e espaços únicos: "Palhoça – São José" = "palhoca - sao jose". */
export function normalizar(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

const inteiro = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100000 ? v : null;

export async function buscarPreFichas(missaoExterna?: string | null): Promise<RespostaApi> {
  const { url, token } = apiConfigurada();
  if (!url || !token) return { ok: false, erro: 'A API não está configurada (faltam PREFICHAS_API_URL e PREFICHAS_API_TOKEN na Vercel).' };
  let alvo: URL;
  try {
    alvo = new URL(url);
  } catch {
    return { ok: false, erro: 'PREFICHAS_API_URL não é um endereço válido.' };
  }
  const local = alvo.hostname === 'localhost' || alvo.hostname === '127.0.0.1';
  if (alvo.protocol !== 'https:' && !(local && process.env.NODE_ENV !== 'production')) {
    return { ok: false, erro: 'A API precisa usar https.' };
  }
  if (missaoExterna) alvo.searchParams.set('missao', missaoExterna);

  let texto: string;
  try {
    const r = await fetch(alvo, {
      headers: { authorization: `Bearer ${process.env.PREFICHAS_API_TOKEN}`, accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return { ok: false, erro: `A API respondeu ${r.status}${r.status === 401 || r.status === 403 ? ' (token recusado)' : ''}.` };
    texto = await r.text();
  } catch (e) {
    const msg = e instanceof Error ? e.name : '';
    return { ok: false, erro: msg === 'TimeoutError' ? 'A API demorou mais de 10 segundos.' : 'Não foi possível falar com a API.' };
  }
  if (texto.length > 1_000_000) return { ok: false, erro: 'A resposta da API é grande demais.' };

  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return { ok: false, erro: 'A API não devolveu JSON.' };
  }
  const lista = (json as { nucleos?: unknown })?.nucleos;
  if (!Array.isArray(lista) || lista.length === 0 || lista.length > 200) {
    return { ok: false, erro: 'Formato inesperado: esperava { "nucleos": [ ... ] } com até 200 itens.' };
  }
  const itens: ItemExterno[] = [];
  for (const [i, x] of lista.entries()) {
    const o = x as Record<string, unknown>;
    const pre = inteiro(o?.pre_fichas);
    const fora = o?.pre_fichas_fora === undefined ? 0 : inteiro(o.pre_fichas_fora);
    const codigo = typeof o?.codigo === 'string' && o.codigo.trim() ? o.codigo.trim() : null;
    const nome = typeof o?.nome === 'string' && o.nome.trim() ? o.nome.trim() : null;
    if (pre === null || fora === null || (!codigo && !nome)) {
      return { ok: false, erro: `Item ${i + 1} inválido: precisa de "codigo" ou "nome" e de "pre_fichas" inteiro (0 a 100000).` };
    }
    itens.push({ codigo, nome, pre_fichas: pre, pre_fora: fora });
  }
  const em = (json as { atualizado_em?: unknown }).atualizado_em;
  return { ok: true, itens, atualizadoEm: typeof em === 'string' ? em.slice(0, 40) : null };
}

export type NucleoBanco = { id: string; nome: string; codigo_externo: string | null };
export type Casamento = {
  ligados: { nucleo: NucleoBanco; item: ItemExterno }[];
  semCorrespondencia: ItemExterno[];
  semRetorno: NucleoBanco[];
};

/** Liga cada item da API a um núcleo: primeiro pelo código externo, depois pelo nome normalizado. */
export function casar(nucleos: NucleoBanco[], itens: ItemExterno[]): Casamento {
  const porCodigo = new Map(nucleos.filter((n) => n.codigo_externo).map((n) => [n.codigo_externo!.toLowerCase(), n]));
  const porNome = new Map(nucleos.map((n) => [normalizar(n.nome), n]));
  const usados = new Set<string>();
  const ligados: Casamento['ligados'] = [];
  const semCorrespondencia: ItemExterno[] = [];
  for (const item of itens) {
    const n = (item.codigo && porCodigo.get(item.codigo.toLowerCase())) || (item.nome && porNome.get(normalizar(item.nome))) || null;
    if (!n || usados.has(n.id)) { semCorrespondencia.push(item); continue; }
    usados.add(n.id);
    ligados.push({ nucleo: n, item });
  }
  return { ligados, semCorrespondencia, semRetorno: nucleos.filter((n) => !usados.has(n.id)) };
}
