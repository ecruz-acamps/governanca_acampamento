'use server';

import { revalidatePath } from 'next/cache';
import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { dataOuNulo, isUuid, nz, uuidOuNulo } from '@/lib/form';
import { requirePerm } from '@/lib/session';

const R = '/conselho';
const SITUACOES = ['planejada', 'em_andamento', 'concluida', 'cancelada'];
const FUNCOES = ['pregador', 'coordenador_setor', 'equipe'];

/** Art. 26 par. unico: integrantes designados pelo Orientador Espiritual entre os associados. */
export async function designarMembro(formData: FormData) {
  const u = await requirePerm('conselho:escrever');
  const assoc = nz(formData.get('associado_id'));
  const data = dataOuNulo(formData.get('designado_em'));
  const area = nz(formData.get('area_pastoral'));
  if (!isUuid(assoc)) voltar(R, '', 'Escolha o associado.');
  if (!data) voltar(R, '', 'Informe a data da designação pelo Orientador Espiritual.');
  const erro = await tentar(() => run(u.id, async (tx) => {
    await tx`insert into gov.conselho_geral_membro (associado_id, area_pastoral, designado_em)
             values (${assoc}, ${area}, ${data})`;
  }));
  revalidatePath(R);
  voltar(R, 'Membro designado para o Conselho Geral.', erro);
}

export async function encerrarMembro(formData: FormData) {
  const u = await requirePerm('conselho:escrever');
  const id = nz(formData.get('id'));
  if (!isUuid(id)) voltar(R, '', 'Registro inválido.');
  const erro = await tentar(() => run(u.id, async (tx) => {
    await tx`update gov.conselho_geral_membro set encerrado_em = current_date where id = ${id} and encerrado_em is null`;
  }));
  revalidatePath(R);
  voltar(R, 'Designação encerrada.', erro);
}

export async function criarMissao(formData: FormData) {
  const u = await requirePerm('conselho:escrever');
  const nome = nz(formData.get('nome'));
  const ini = dataOuNulo(formData.get('data_inicio'));
  const fim = dataOuNulo(formData.get('data_fim'));
  if (!nome) voltar(R, '', 'Informe o nome da missão.');
  let novo: string | null = null;
  const erro = await tentar(() => run(u.id, async (tx) => {
    const [r] = await tx<{ id: string }[]>`
      insert into gov.missao (nome, data_inicio, data_fim) values (${nome}, ${ini}, ${fim}) returning id`;
    novo = r.id;
  }));
  if (erro || !novo) voltar(R, '', erro);
  voltar(`${R}/missoes/${novo}`, 'Missão criada. Defina o coordenador e leve à aprovação do Conselho Geral.');
}

/** Coordenador: associado OU pessoa de fora (nome livre). */
export async function definirCoordenador(formData: FormData) {
  const u = await requirePerm('conselho:escrever');
  const id = nz(formData.get('id'));
  const coord = nz(formData.get('coordenador_id'));
  const nome = nz(formData.get('coordenador_nome'));
  const contato = nz(formData.get('coordenador_contato'));
  if (!isUuid(id)) voltar(R, '', 'Missão inválida.');
  const caminho = `${R}/missoes/${id}`;
  if (!isUuid(coord) && !nome) voltar(caminho, '', 'Escolha um associado ou digite o nome do coordenador.');
  const assoc = isUuid(coord) ? coord : null;
  const erro = await tentar(() => run(u.id, async (tx) => {
    await tx`update gov.missao
                set coordenador_id = ${assoc}, coordenador_nome = ${assoc ? null : nome},
                    coordenador_contato = ${assoc ? null : contato}, coordenador_aprovado_em = null
              where id = ${id}`;
  }));
  voltar(caminho, 'Coordenador indicado. Falta a aprovação do Conselho Geral.', erro);
}

/** Art. 26 d: o Conselho Geral aprova os coordenadores das missoes. */
export async function aprovarCoordenador(formData: FormData) {
  const u = await requirePerm('conselho:escrever');
  const id = nz(formData.get('id'));
  const data = dataOuNulo(formData.get('data'));
  if (!isUuid(id)) voltar(R, '', 'Missão inválida.');
  const caminho = `${R}/missoes/${id}`;
  if (!data) voltar(caminho, '', 'Informe a data da aprovação pelo Conselho Geral.');
  const erro = await tentar(() => run(u.id, async (tx) => {
    await tx`update gov.missao set coordenador_aprovado_em = ${data} where id = ${id} and (coordenador_id is not null or coordenador_nome is not null)`;
  }));
  voltar(caminho, 'Coordenador aprovado pelo Conselho Geral.', erro);
}

export async function mudarStatusMissao(formData: FormData) {
  const u = await requirePerm('conselho:escrever');
  const id = nz(formData.get('id'));
  const st = nz(formData.get('status'));
  if (!isUuid(id) || !st || !SITUACOES.includes(st)) voltar(R, '', 'Dados inválidos.');
  const caminho = `${R}/missoes/${id}`;
  const erro = await tentar(() => run(u.id, async (tx) => {
    await tx`update gov.missao set status = ${st} where id = ${id}`;
  }));
  voltar(caminho, 'Situação da missão atualizada.', erro);
}

/** Art. 25 b e c: pregadores e auxiliares (associados ou não). */
export async function adicionarEquipe(formData: FormData) {
  const u = await requirePerm('conselho:escrever');
  const id = nz(formData.get('id'));
  const assoc = uuidOuNulo(formData.get('associado_id'));
  const nome = nz(formData.get('nome'));
  const contato = nz(formData.get('contato'));
  const funcao = nz(formData.get('funcao'));
  if (!isUuid(id)) voltar(R, '', 'Missão inválida.');
  const caminho = `${R}/missoes/${id}`;
  if (!funcao || !FUNCOES.includes(funcao)) voltar(caminho, '', 'Escolha a função.');
  if (!assoc && !nome) voltar(caminho, '', 'Escolha um associado ou digite o nome da pessoa.');
  const erro = await tentar(() => run(u.id, async (tx) => {
    await tx`insert into gov.missao_equipe (missao_id, associado_id, nome, contato, funcao)
             values (${id}, ${assoc}, ${assoc ? null : nome}, ${assoc ? null : contato}, ${funcao})`;
  }));
  voltar(caminho, 'Adicionado à equipe.', erro);
}

export async function aprovarEquipe(formData: FormData) {
  const u = await requirePerm('conselho:escrever');
  const id = nz(formData.get('id'));
  const linha = nz(formData.get('linha'));
  if (!isUuid(id) || !isUuid(linha)) voltar(R, '', 'Dados inválidos.');
  const caminho = `${R}/missoes/${id}`;
  const erro = await tentar(() => run(u.id, async (tx) => {
    await tx`update gov.missao_equipe set aprovado_em = current_date where id = ${linha} and missao_id = ${id}`;
  }));
  voltar(caminho, 'Equipe aprovada pela coordenação.', erro);
}

export async function removerEquipe(formData: FormData) {
  const u = await requirePerm('conselho:escrever');
  const id = nz(formData.get('id'));
  const linha = nz(formData.get('linha'));
  if (!isUuid(id) || !isUuid(linha)) voltar(R, '', 'Dados inválidos.');
  const caminho = `${R}/missoes/${id}`;
  const erro = await tentar(() => run(u.id, async (tx) => {
    await tx`delete from gov.missao_equipe where id = ${linha} and missao_id = ${id}`;
  }));
  voltar(caminho, 'Removido da equipe.', erro);
}
