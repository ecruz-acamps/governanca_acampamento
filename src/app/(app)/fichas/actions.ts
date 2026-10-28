'use server';

import { redirect } from 'next/navigation';
import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { inteiroOuNulo, isUuid, nz } from '@/lib/form';
import { requirePerm } from '@/lib/session';

const R = '/fichas';
const aqui = (d?: string | null) => (d && isUuid(d) ? `${R}?d=${d}` : R);

export async function criarDistribuicao(formData: FormData) {
  const u = await requirePerm('fichas:escrever');
  const titulo = nz(formData.get('titulo'));
  const ano = inteiroOuNulo(formData.get('ano'));
  const total = inteiroOuNulo(formData.get('total'));
  const reserva = inteiroOuNulo(formData.get('reserva')) ?? 0;
  if (!titulo) voltar(R, '', 'Informe o título (ex.: Acampamento 2027).');
  if (!ano) voltar(R, '', 'Informe o ano.');
  if (total === null) voltar(R, '', 'Informe o total de fichas.');
  let novo: string | null = null;
  const erro = await tentar(() => run(u.id, async (tx) => {
    const [r] = await tx<{ id: string }[]>`
      insert into gov.distribuicao_fichas (titulo, ano, total_fichas, reserva_fichas) values (${titulo}, ${ano}, ${total}, ${reserva}) returning id`;
    novo = r.id;
  }));
  if (erro || !novo) voltar(R, '', erro);
  redirect(`${aqui(novo)}&ok=` + encodeURIComponent('Distribuição criada. Preencha as pré-fichas de cada núcleo.'));
}

/** Salva o total de fichas e as pré-fichas (lista de espera) de cada núcleo. */
export async function salvarDistribuicao(formData: FormData) {
  const u = await requirePerm('fichas:escrever');
  const id = nz(formData.get('id'));
  if (!isUuid(id)) redirect(R);
  const total = inteiroOuNulo(formData.get('total'));
  if (total === null) voltar(aqui(id), '', 'Informe o total de fichas.');
  const reserva = inteiroOuNulo(formData.get('reserva')) ?? 0;
  const nucleos = formData.getAll('nucleo').map(String).filter(isUuid);
  const erro = await tentar(() => run(u.id, async (tx) => {
    await tx`update gov.distribuicao_fichas set total_fichas = ${total}, reserva_fichas = ${reserva} where id = ${id}`;
    for (const n of nucleos) {
      const pre = inteiroOuNulo(formData.get(`pre_${n}`)) ?? 0;
      await tx`
        insert into gov.distribuicao_pre (distribuicao_id, nucleo_id, pre_fichas) values (${id}, ${n}, ${pre})
        on conflict (distribuicao_id, nucleo_id) do update set pre_fichas = excluded.pre_fichas`;
    }
  }));
  voltar(aqui(id), 'Distribuição recalculada.', erro);
}

export async function excluirDistribuicao(formData: FormData) {
  const u = await requirePerm('fichas:escrever');
  const id = nz(formData.get('id'));
  if (!isUuid(id)) redirect(R);
  const erro = await tentar(() => run(u.id, async (tx) => {
    await tx`delete from gov.distribuicao_fichas where id = ${id}`;
  }));
  voltar(R, 'Distribuição excluída.', erro);
}

export async function criarNucleo(formData: FormData) {
  const u = await requirePerm('fichas:escrever');
  const nome = nz(formData.get('nome'));
  const d = nz(formData.get('d'));
  if (!nome) voltar(aqui(d), '', 'Informe o nome do núcleo.');
  const erro = await tentar(() => run(u.id, async (tx) => {
    await tx`insert into gov.nucleo (nome) values (${nome})`;
  }));
  voltar(aqui(d), 'Núcleo cadastrado.', erro);
}

/** Fichas fixas: vazio = entra na divisão proporcional. */
export async function salvarNucleo(formData: FormData) {
  const u = await requirePerm('fichas:escrever');
  const id = nz(formData.get('id'));
  const d = nz(formData.get('d'));
  if (!isUuid(id)) redirect(aqui(d));
  const fixas = inteiroOuNulo(formData.get('fixas'));
  const erro = await tentar(() => run(u.id, async (tx) => {
    await tx`update gov.nucleo set fichas_fixas = ${fixas} where id = ${id}`;
  }));
  voltar(aqui(d), 'Núcleo atualizado.', erro);
}

export async function alternarNucleo(formData: FormData) {
  const u = await requirePerm('fichas:escrever');
  const id = nz(formData.get('id'));
  const d = nz(formData.get('d'));
  if (!isUuid(id)) redirect(aqui(d));
  const erro = await tentar(() => run(u.id, async (tx) => {
    await tx`update gov.nucleo set ativo = not ativo where id = ${id}`;
  }));
  voltar(aqui(d), 'Situação do núcleo alterada.', erro);
}
