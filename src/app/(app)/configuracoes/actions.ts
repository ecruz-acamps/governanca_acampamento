'use server';

import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { lerValor } from '@/lib/format';
import { nz } from '@/lib/form';
import { requirePerm } from '@/lib/session';

const R = '/configuracoes';

/** Peso das pré-fichas de fora da Arquidiocese na divisão das fichas (0 a 1). */
export async function salvarPesoFora(formData: FormData) {
  const u = await requirePerm('fichas:escrever');
  const peso = lerValor(nz(formData.get('peso_fora')));
  if (peso === null || peso < 0 || peso > 1) voltar(R, '', 'O peso deve estar entre 0 e 1 (ex.: 0,5).');
  const valor = String(Math.round(peso * 100) / 100);
  const erro = await tentar(() => run(u.id, async (tx) => {
    await tx`
      insert into gov.configuracao (id, valor) values ('peso_fora', ${valor})
      on conflict (id) do update set valor = excluded.valor, atualizado_em = now()`;
  }));
  voltar(R, 'Peso salvo. A divisão das fichas já usa o novo valor.', erro);
}
