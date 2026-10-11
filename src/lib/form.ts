const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
export const isData = (v: unknown): v is string => typeof v === 'string' && DATA.test(v);

/** Texto do formulário: vazio vira null. */
export function nz(v: FormDataEntryValue | null | undefined): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s === '' ? null : s;
}

export const flag = (v: FormDataEntryValue | null | undefined): boolean => v === 'on';

export function uuidOuNulo(v: FormDataEntryValue | null | undefined): string | null {
  const s = nz(v);
  return s && isUuid(s) ? s : null;
}

export function dataOuNulo(v: FormDataEntryValue | null | undefined): string | null {
  const s = nz(v);
  return s && isData(s) ? s : null;
}

export function inteiroOuNulo(v: FormDataEntryValue | null | undefined): number | null {
  const s = nz(v);
  if (!s || !/^\d{1,4}$/.test(s)) return null;
  return Number(s);
}

export const msg = (texto: string) => encodeURIComponent(texto);
