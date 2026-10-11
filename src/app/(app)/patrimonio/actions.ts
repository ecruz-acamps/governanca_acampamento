'use server';

import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { dataOuNulo, isUuid, nz, uuidOuNulo } from '@/lib/form';
import { lerValor, ORIGEM_LABEL } from '@/lib/format';
import { requirePerm } from '@/lib/session';

export async function criarBem(formData: FormData) {
  const u = await requirePerm('patrimonio:escrever');
  const descricao = nz(formData.get('descricao'));
  if (!descricao) voltar('/patrimonio', '', 'Informe a descrição do bem.');
  const tombo = nz(formData.get('numero_tombo'));
  const categoria = nz(formData.get('categoria'));
  const local = nz(formData.get('local'));
  const data = dataOuNulo(formData.get('data_aquisicao'));
  const txtValor = nz(formData.get('valor'));
  const valor = lerValor(txtValor);
  if (txtValor && valor === null) voltar('/patrimonio', '', 'Valor inválido.');
  const origemTxt = nz(formData.get('origem'));
  const origem = origemTxt && origemTxt in ORIGEM_LABEL ? origemTxt : null;
  const convenio = uuidOuNulo(formData.get('convenio_id'));
  const resp = uuidOuNulo(formData.get('responsavel_id'));
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      await tx`
        insert into gov.patrimonio (numero_tombo, descricao, categoria, data_aquisicao, valor, origem, convenio_id, local, responsavel_id)
        values (${tombo}, ${descricao}, ${categoria}, ${data}, ${valor}, ${origem}, ${convenio}, ${local}, ${resp})
      `;
    });
  });
  voltar('/patrimonio', 'Bem cadastrado no inventário.', erro);
}

export async function baixarBem(formData: FormData) {
  const u = await requirePerm('patrimonio:escrever');
  const id = nz(formData.get('id'));
  const delib = nz(formData.get('deliberacao_id'));
  const parecer = dataOuNulo(formData.get('parecer_cf_em'));
  const baixa = dataOuNulo(formData.get('baixa_em'));
  if (!isUuid(id)) voltar('/patrimonio', '', 'Bem inválido.');
  if (!isUuid(delib)) voltar('/patrimonio', '', 'Escolha a deliberação da assembleia que autorizou a baixa.');
  if (!parecer) voltar('/patrimonio', '', 'Informe a data do parecer do Conselho Fiscal (Art. 22, d).');
  if (!baixa) voltar('/patrimonio', '', 'Informe a data da baixa.');
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      await tx`
        update gov.patrimonio
           set situacao = 'baixado', baixa_em = ${baixa}, baixa_deliberacao_id = ${delib}, parecer_cf_baixa_em = ${parecer}
         where id = ${id} and situacao = 'ativo'
      `;
    });
  });
  voltar('/patrimonio', 'Baixa registrada.', erro);
}
