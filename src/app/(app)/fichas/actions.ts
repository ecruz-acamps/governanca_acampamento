'use server';

import { redirect } from 'next/navigation';
import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { dataOuNulo, inteiroOuNulo, isUuid, nz, uuidOuNulo } from '@/lib/form';
import { lerValor } from '@/lib/format';
import { requirePerm } from '@/lib/session';

const R = '/fichas';
const aqui = (d?: string | null) => (d && isUuid(d) ? `${R}?d=${d}` : R);

export async function criarDistribuicao(formData: FormData) {
  const u = await requirePerm('fichas:escrever');
  const titulo = nz(formData.get('titulo'));
  const ano = inteiroOuNulo(formData.get('ano'));
  const total = inteiroOuNulo(formData.get('total'));
  const reserva = inteiroOuNulo(formData.get('reserva')) ?? 0;
  const missao = uuidOuNulo(formData.get('missao_id'));
  if (!titulo) voltar(R, '', 'Informe o título (ex.: Acampamento 2027).');
  if (!ano) voltar(R, '', 'Informe o ano.');
  if (total === null) voltar(R, '', 'Informe o total de fichas.');
  let novo: string | null = null;
  const erro = await tentar(() => run(u.id, async (tx) => {
    const [r] = await tx<{ id: string }[]>`
      insert into gov.distribuicao_fichas (titulo, ano, total_fichas, reserva_fichas, missao_id) values (${titulo}, ${ano}, ${total}, ${reserva}, ${missao}) returning id`;
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
      const fora = inteiroOuNulo(formData.get(`fora_${n}`)) ?? 0;
      await tx`
        insert into gov.distribuicao_pre (distribuicao_id, nucleo_id, pre_fichas, pre_fora) values (${id}, ${n}, ${pre}, ${fora})
        on conflict (distribuicao_id, nucleo_id) do update set pre_fichas = excluded.pre_fichas, pre_fora = excluded.pre_fora`;
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

/** Dados que entram impressos nas fichas de inscrição (PDF). */
export async function salvarDadosFichas(formData: FormData) {
  const u = await requirePerm('fichas:escrever');
  const id = nz(formData.get('id'));
  if (!isUuid(id)) redirect(R);
  const numero = nz(formData.get('missao_numero'));
  const saida = dataOuNulo(formData.get('saida'));
  const fim = dataOuNulo(formData.get('encerramento'));
  const txtValor = nz(formData.get('valor'));
  const valor = lerValor(txtValor);
  const pix = nz(formData.get('pix'));
  const contato = nz(formData.get('contato'));
  const inicio = inteiroOuNulo(formData.get('inicio')) ?? 1;
  if (!numero || !/^\d{1,3}$/.test(numero)) voltar(aqui(id), '', 'Informe o número da missão (ex.: 23).');
  if (!saida || !fim) voltar(aqui(id), '', 'Informe a data de saída e a de encerramento.');
  if (fim < saida) voltar(aqui(id), '', 'O encerramento não pode ser antes da saída.');
  if (valor === null || valor <= 0 || valor >= 100000) voltar(aqui(id), '', 'Informe o valor da inscrição.');
  if (!pix || !contato) voltar(aqui(id), '', 'Informe a chave PIX e o contato do financeiro.');
  if (pix.length > 120 || contato.length > 120) voltar(aqui(id), '', 'PIX ou contato muito longo.');
  if (inicio < 1) voltar(aqui(id), '', 'O número inicial deve ser 1 ou mais.');
  const erro = await tentar(() => run(u.id, async (tx) => {
    await tx`
      update gov.distribuicao_fichas
         set ficha_missao_numero = ${numero}, ficha_saida = ${saida}, ficha_encerramento = ${fim},
             ficha_valor = ${valor}, ficha_pix = ${pix}, ficha_contato = ${contato}, ficha_inicio = ${inicio}
       where id = ${id}`;
  }));
  voltar(aqui(id), 'Dados das fichas salvos. Já dá para baixar os PDFs.', erro);
}
