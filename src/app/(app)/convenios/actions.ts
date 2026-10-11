'use server';

import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { dataOuNulo, flag, isUuid, nz } from '@/lib/form';
import { CONVENIO_TIPO_LABEL, hoje, lerValor } from '@/lib/format';
import { requirePerm } from '@/lib/session';

export async function criarConvenio(formData: FormData) {
  const u = await requirePerm('convenios:escrever');
  const tipo = nz(formData.get('tipo'));
  const origem = nz(formData.get('origem_nome'));
  if (!tipo || !(tipo in CONVENIO_TIPO_LABEL)) voltar('/convenios', '', 'Escolha o tipo.');
  if (!origem) voltar('/convenios', '', 'Informe a origem (quem doa ou concede).');
  const valorTxt = nz(formData.get('valor_previsto'));
  const valor = lerValor(valorTxt);
  if (valorTxt && valor === null) voltar('/convenios', '', 'Valor inválido.');
  const publica = flag(formData.get('verba_publica')) || tipo === 'subvencao' || tipo === 'auxilio';
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`
      insert into gov.convenio_doacao (tipo, origem_nome, descricao, valor_previsto, verba_publica, finalidade_vinculada)
      values (${tipo}, ${origem}, ${nz(formData.get('descricao'))}, ${valor}, ${publica}, ${nz(formData.get('finalidade'))})
    `);
  });
  voltar('/convenios', 'Registrado como "em análise". Colha as três aprovações para aceitar.', erro);
}

export async function aprovarConvenio(formData: FormData) {
  const u = await requirePerm('convenios:escrever');
  const id = nz(formData.get('id'));
  const etapa = nz(formData.get('etapa'));
  if (!isUuid(id)) voltar('/convenios', '', 'Registro inválido.');
  const data = dataOuNulo(formData.get('data')) ?? hoje();
  // colunas fixas por etapa (nunca montar nome de coluna a partir da entrada)
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      if (etapa === 'conselho') {
        await tx`update gov.convenio_doacao set aprovado_conselho_em = ${data} where id = ${id} and status = 'em_analise'`;
      } else if (etapa === 'espiritual') {
        await tx`update gov.convenio_doacao set aprovado_orientacao_espiritual_em = ${data} where id = ${id} and status = 'em_analise'`;
      } else if (etapa === 'coordenacao') {
        await tx`update gov.convenio_doacao set aprovado_coordenacao_geral_em = ${data} where id = ${id} and status = 'em_analise'`;
      } else {
        throw Object.assign(new Error('Etapa inválida.'), { code: 'P0001' });
      }
    });
  });
  voltar('/convenios', 'Aprovação registrada.', erro);
}

export async function decidirConvenio(formData: FormData) {
  const u = await requirePerm('convenios:escrever');
  const id = nz(formData.get('id'));
  const acao = nz(formData.get('acao'));
  if (!isUuid(id) || (acao !== 'aceito' && acao !== 'recusado')) voltar('/convenios', '', 'Pedido inválido.');
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`update gov.convenio_doacao set status = ${acao} where id = ${id} and status = 'em_analise'`);
  });
  voltar('/convenios', acao === 'aceito' ? 'Aceito.' : 'Recusado.', erro);
}
