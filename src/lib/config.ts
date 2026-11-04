import type { Sql } from 'postgres';

/** Peso (0 a 1) das pré-fichas de fora da Arquidiocese. Configuração global, em Configurações. */
export const PESO_FORA_PADRAO = 0.5;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function lerPesoFora(tx: Sql<any>): Promise<number> {
  const [r] = await tx<{ valor: string }[]>`select valor from gov.configuracao where id = 'peso_fora'`;
  const n = Number(r?.valor);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : PESO_FORA_PADRAO;
}
