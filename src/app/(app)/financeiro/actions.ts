'use server';

import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { dataOuNulo, isUuid, nz, uuidOuNulo } from '@/lib/form';
import { lerValor, ORIGEM_LABEL } from '@/lib/format';
import { requirePerm } from '@/lib/session';

const regra = (t: string) => Object.assign(new Error(t), { code: 'P0001' });

export async function criarLancamento(formData: FormData) {
  const u = await requirePerm('financeiro:escrever');
  const data = dataOuNulo(formData.get('data'));
  const tipo = nz(formData.get('tipo'));
  const descricao = nz(formData.get('descricao'));
  const valor = lerValor(nz(formData.get('valor')));
  const origem = nz(formData.get('origem')) ?? 'propria';
  const convenio = uuidOuNulo(formData.get('convenio_id'));
  const autorizado = nz(formData.get('autorizado_por'));
  const ref = nz(formData.get('comprovante_ref'));
  if (!data) voltar('/financeiro', '', 'Informe a data.');
  if (tipo !== 'receita' && tipo !== 'despesa') voltar('/financeiro', '', 'Escolha receita ou despesa.');
  if (!descricao) voltar('/financeiro', '', 'Descreva o lançamento.');
  if (valor === null || valor <= 0) voltar('/financeiro', '', 'Informe um valor maior que zero.');
  if (!(origem in ORIGEM_LABEL)) voltar('/financeiro', '', 'Origem inválida.');
  if ((origem === 'verba_publica' || origem === 'convenio') && !convenio) {
    voltar('/financeiro', '', 'Recurso de verba pública ou convênio precisa estar ligado ao convênio/doação correspondente (Art. 27 §3).');
  }
  const exercicio = data.slice(0, 4);
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      if (convenio) {
        const [c] = await tx<{ status: string }[]>`select status from gov.convenio_doacao where id = ${convenio}`;
        if (!c || c.status !== 'aceito') throw regra('O convênio/doação precisa estar aceito (com as três aprovações) para receber lançamentos.');
      }
      let doc: string | null = null;
      if (ref) {
        const [d] = await tx<{ id: string }[]>`
          insert into gov.documento (tipo, titulo, storage_path, enviado_por)
          values ('comprovante', ${'Comprovante: ' + descricao.slice(0, 80)}, ${'fisico:' + ref}, ${u.nome})
          returning id
        `;
        doc = d.id;
      }
      await tx`
        insert into gov.lancamento (data, tipo, categoria, descricao, valor, origem, convenio_id, autorizado_por, comprovante_documento_id, lancado_por)
        values (${data}, ${tipo}, ${nz(formData.get('categoria'))}, ${descricao}, ${valor}, ${origem}, ${convenio},
                ${tipo === 'despesa' ? autorizado : null}, ${doc}, ${u.nome})
      `;
    });
  });
  voltar(`/financeiro?ano=${exercicio}`, 'Lançamento registrado.', erro);
}

export async function anexarComprovante(formData: FormData) {
  const u = await requirePerm('financeiro:escrever');
  const id = nz(formData.get('id'));
  const ref = nz(formData.get('comprovante_ref'));
  const ano = nz(formData.get('ano')) ?? '';
  if (!isUuid(id) || !ref) voltar(`/financeiro?ano=${ano}`, '', 'Informe a referência do comprovante.');
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const [l] = await tx<{ descricao: string }[]>`select descricao from gov.lancamento where id = ${id}`;
      if (!l) throw regra('Lançamento não encontrado.');
      const [d] = await tx<{ id: string }[]>`
        insert into gov.documento (tipo, titulo, storage_path, enviado_por)
        values ('comprovante', ${'Comprovante: ' + l.descricao.slice(0, 80)}, ${'fisico:' + ref}, ${u.nome}) returning id
      `;
      await tx`update gov.lancamento set comprovante_documento_id = ${d.id} where id = ${id}`;
    });
  });
  voltar(`/financeiro?ano=${ano}`, 'Comprovante registrado.', erro);
}
