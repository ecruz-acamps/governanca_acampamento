'use server';

import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { dataOuNulo, isUuid, nz, uuidOuNulo } from '@/lib/form';
import { AREAS_PATRIMONIO, lerValor, ORIGEM_LABEL } from '@/lib/format';
import { escopoPatrimonio, requirePerm } from '@/lib/session';

export async function criarBem(formData: FormData) {
  const u = await requirePerm('patrimonio:escrever');
  const escopo = escopoPatrimonio(u);
  if (escopo === '__nenhuma__') voltar('/patrimonio', '', 'Seu usuário ainda não tem uma área de patrimônio. Peça ao administrador.');
  const areaForm = nz(formData.get('area'));
  const area = escopo ?? areaForm;
  if (!area || !(area in AREAS_PATRIMONIO)) voltar('/patrimonio', '', 'Escolha a área do bem.');
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
        insert into gov.patrimonio (numero_tombo, descricao, categoria, data_aquisicao, valor, origem, convenio_id, local, responsavel_id, area)
        values (${tombo}, ${descricao}, ${categoria}, ${data}, ${valor}, ${origem}, ${convenio}, ${local}, ${resp}, ${area})
      `;
    });
  });
  voltar('/patrimonio', 'Bem cadastrado no inventário.', erro);
}

export async function baixarBem(formData: FormData) {
  const u = await requirePerm('patrimonio:escrever');
  const escopo = escopoPatrimonio(u);
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
         where id = ${id} and situacao = 'ativo' and (${escopo}::text is null or area = ${escopo})
      `;
    });
  });
  voltar('/patrimonio', 'Baixa registrada.', erro);
}

/** Define/corrige a área de um bem (quem enxerga todas as áreas: admin, presidente, superadmin). */
export async function definirAreaBem(formData: FormData) {
  const u = await requirePerm('patrimonio:escrever');
  if (escopoPatrimonio(u) !== null) voltar('/patrimonio', '', 'Sem permissão para mudar a área do bem.');
  const id = nz(formData.get('id'));
  const area = nz(formData.get('area'));
  if (!isUuid(id)) voltar('/patrimonio', '', 'Bem inválido.');
  if (!area || !(area in AREAS_PATRIMONIO)) voltar('/patrimonio', '', 'Escolha a área.');
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`update gov.patrimonio set area = ${area} where id = ${id}`);
  });
  voltar('/patrimonio', 'Área do bem atualizada.', erro);
}
