'use server';

import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { dataOuNulo, inteiroOuNulo, isUuid, nz } from '@/lib/form';
import { hoje } from '@/lib/format';
import { requirePerm } from '@/lib/session';

export async function gerarObrigacoes(formData: FormData) {
  const u = await requirePerm('calendario:escrever');
  const ano = inteiroOuNulo(formData.get('ano'));
  if (!ano || ano < 2000 || ano > 2100) voltar('/calendario', '', 'Ano inválido.');
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`select gov.gerar_obrigacoes(${ano})`);
  });
  voltar(`/calendario?ano=${ano}`, `Obrigações de ${ano} geradas (prazos já passados são ignorados).`, erro);
}

export async function atualizarObrigacao(formData: FormData) {
  const u = await requirePerm('calendario:escrever');
  const id = nz(formData.get('id'));
  const acao = nz(formData.get('acao'));
  const ano = inteiroOuNulo(formData.get('ano')) ?? Number(hoje().slice(0, 4));
  if (!isUuid(id) || !acao || !['cumprida', 'dispensada', 'pendente'].includes(acao)) {
    voltar(`/calendario?ano=${ano}`, '', 'Pedido inválido.');
  }
  const quando = dataOuNulo(formData.get('cumprida_em')) ?? hoje();
  const obs = nz(formData.get('observacao'));
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`
      update gov.obrigacao
         set status = ${acao},
             cumprida_em = ${acao === 'cumprida' ? quando : null},
             observacao = ${obs}
       where id = ${id}
    `);
  });
  voltar(`/calendario?ano=${ano}`, 'Obrigação atualizada.', erro);
}
