'use server';

import { redirect } from 'next/navigation';
import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { dataOuNulo, flag, inteiroOuNulo, isUuid, nz, uuidOuNulo } from '@/lib/form';
import { ACAMPAMENTO_LABEL, hoje } from '@/lib/format';
import { requirePerm } from '@/lib/session';

export async function salvarAssociado(formData: FormData) {
  const u = await requirePerm('associados:escrever');
  const idBruto = nz(formData.get('id'));
  const id = idBruto && isUuid(idBruto) ? idBruto : null;
  const base = id ? `/associados/${id}` : '/associados/novo';

  const nome = nz(formData.get('nome'));
  if (!nome) voltar(base, '', 'Informe o nome.');
  const tipoBruto = nz(formData.get('acampamento_tipo'));
  const tipo = tipoBruto && tipoBruto in ACAMPAMENTO_LABEL ? tipoBruto : null;
  const campos = {
    nome,
    email: nz(formData.get('email'))?.toLowerCase() ?? null,
    telefone: nz(formData.get('telefone')),
    data_nascimento: dataOuNulo(formData.get('data_nascimento')),
    acampamento_tipo: tipo,
    acampamento_ano: inteiroOuNulo(formData.get('acampamento_ano')),
    primeira_eucaristia: flag(formData.get('primeira_eucaristia')),
    participou_missao_senior: flag(formData.get('participou_missao_senior')),
    motivo_pedido: nz(formData.get('motivo_pedido')),
    data_pedido: dataOuNulo(formData.get('data_pedido')),
    data_promessa: dataOuNulo(formData.get('data_promessa')),
    observacoes: nz(formData.get('observacoes')),
    proposto_por: uuidOuNulo(formData.get('proposto_por')),
  };
  if (id && campos.proposto_por === id) voltar(base, '', 'O associado não pode propor a si mesmo.');

  let novoId = id;
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      if (id) {
        await tx`
          update gov.associado set
            nome = ${campos.nome}, email = ${campos.email}, telefone = ${campos.telefone},
            data_nascimento = ${campos.data_nascimento}, acampamento_tipo = ${campos.acampamento_tipo},
            acampamento_ano = ${campos.acampamento_ano}, primeira_eucaristia = ${campos.primeira_eucaristia},
            participou_missao_senior = ${campos.participou_missao_senior}, motivo_pedido = ${campos.motivo_pedido},
            data_pedido = ${campos.data_pedido}, data_promessa = ${campos.data_promessa},
            observacoes = ${campos.observacoes}, proposto_por = ${campos.proposto_por}
          where id = ${id}
        `;
      } else {
        const [r] = await tx<{ id: string }[]>`
          insert into gov.associado
            (nome, email, telefone, data_nascimento, acampamento_tipo, acampamento_ano, primeira_eucaristia,
             participou_missao_senior, motivo_pedido, data_pedido, data_promessa, observacoes, proposto_por)
          values
            (${campos.nome}, ${campos.email}, ${campos.telefone}, ${campos.data_nascimento}, ${campos.acampamento_tipo},
             ${campos.acampamento_ano}, ${campos.primeira_eucaristia}, ${campos.participou_missao_senior},
             ${campos.motivo_pedido}, ${campos.data_pedido}, ${campos.data_promessa}, ${campos.observacoes}, ${campos.proposto_por})
          returning id
        `;
        novoId = r.id;
      }
    });
  });
  if (erro) voltar(base, '', erro);
  voltar(`/associados/${novoId}`, 'Cadastro salvo.');
}

export async function acompanhar(formData: FormData) {
  const u = await requirePerm('associados:escrever');
  const id = nz(formData.get('id'));
  if (!isUuid(id)) redirect('/associados');
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`
      update gov.associado set status = 'em_acompanhamento'
       where id = ${id} and status = 'interessado'
    `);
  });
  voltar(`/associados/${id}`, 'Passou para “Em acompanhamento”.', erro);
}

export async function admitir(formData: FormData) {
  const u = await requirePerm('associados:escrever');
  const id = nz(formData.get('id'));
  if (!isUuid(id)) redirect('/associados');
  const data = dataOuNulo(formData.get('data_admissao')) ?? hoje();
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`
      update gov.associado set status = 'associado', data_admissao = ${data}
       where id = ${id} and status in ('interessado','em_acompanhamento')
    `);
  });
  voltar(`/associados/${id}`, 'Associado admitido.', erro);
}

export async function desligar(formData: FormData) {
  const u = await requirePerm('associados:escrever');
  const id = nz(formData.get('id'));
  if (!isUuid(id)) redirect('/associados');
  const data = dataOuNulo(formData.get('data_saida')) ?? hoje();
  const motivo = nz(formData.get('motivo_saida'));
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`
      update gov.associado set status = 'desligado', data_saida = ${data}, motivo_saida = ${motivo}
       where id = ${id} and status in ('interessado','em_acompanhamento','associado','suspenso')
    `);
  });
  voltar(`/associados/${id}`, 'Desligamento registrado (Art. 7, q).', erro);
}
