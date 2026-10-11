'use server';

import { redirect } from 'next/navigation';
import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { dataOuNulo, isUuid, nz } from '@/lib/form';
import { MEDIDA_LABEL, MOTIVO_LABEL, hoje } from '@/lib/format';
import { requirePerm } from '@/lib/session';

const regra = (texto: string) => Object.assign(new Error(texto), { code: 'P0001' });

function idDe(formData: FormData): string {
  const id = nz(formData.get('id'));
  if (!isUuid(id)) redirect('/disciplinar');
  return id;
}

export async function abrirProcesso(formData: FormData) {
  const u = await requirePerm('disciplinar:escrever');
  const assoc = nz(formData.get('associado_id'));
  const medida = nz(formData.get('medida'));
  const motivo = nz(formData.get('motivo'));
  const descricao = nz(formData.get('descricao'));
  if (!isUuid(assoc)) voltar('/disciplinar', '', 'Escolha o associado.');
  if (!medida || !(medida in MEDIDA_LABEL)) voltar('/disciplinar', '', 'Escolha a medida.');
  if (!motivo || !(motivo in MOTIVO_LABEL)) voltar('/disciplinar', '', 'Escolha o motivo.');
  if (!descricao) voltar('/disciplinar', '', 'Descreva os fatos.');
  let novo: string | null = null;
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const [r] = await tx<{ id: string }[]>`
        insert into gov.processo_disciplinar (associado_id, medida, motivo, descricao)
        values (${assoc}, ${medida}, ${motivo}, ${descricao}) returning id
      `;
      novo = r.id;
    });
  });
  if (erro) voltar('/disciplinar', '', erro);
  redirect(`/disciplinar/${novo}?ok=` + encodeURIComponent('Processo aberto. Próximos passos: consenso e defesa.'));
}

export async function registrarConsenso(formData: FormData) {
  const u = await requirePerm('disciplinar:escrever');
  const id = idDe(formData);
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`
      update gov.processo_disciplinar set consenso_registrado = true where id = ${id} and status = 'aberto'
    `);
  });
  voltar(`/disciplinar/${id}`, 'Consenso registrado (coordenação geral, conselho e orientador espiritual).', erro);
}

export async function registrarDefesa(formData: FormData) {
  const u = await requirePerm('disciplinar:escrever');
  const id = idDe(formData);
  const quando = dataOuNulo(formData.get('defesa_em')) ?? hoje();
  const texto = nz(formData.get('defesa_texto'));
  if (!texto) voltar(`/disciplinar/${id}`, '', 'Registre a defesa (ou que o associado não se manifestou no prazo).');
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`
      update gov.processo_disciplinar set defesa_apresentada_em = ${quando}, defesa_texto = ${texto}
       where id = ${id} and status = 'aberto'
    `);
  });
  voltar(`/disciplinar/${id}`, 'Defesa registrada.', erro);
}

export async function vincularAssembleiaProcesso(formData: FormData) {
  const u = await requirePerm('disciplinar:escrever');
  const id = idDe(formData);
  const ass = nz(formData.get('assembleia_id'));
  if (!isUuid(ass)) voltar(`/disciplinar/${id}`, '', 'Escolha a assembleia.');
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`
      update gov.processo_disciplinar set assembleia_id = ${ass} where id = ${id} and status <> 'encerrada'
    `);
  });
  voltar(`/disciplinar/${id}`, 'Assembleia ligada ao processo.', erro);
}

/** Aplica a medida. O recurso NÃO suspende os efeitos (Art. 8 §2). */
export async function aplicarMedida(formData: FormData) {
  const u = await requirePerm('disciplinar:escrever');
  const id = idDe(formData);
  const aplicada = dataOuNulo(formData.get('aplicada_em')) ?? hoje();
  const ciencia = dataOuNulo(formData.get('ciencia_em')) ?? aplicada;
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const [p] = await tx<{ associado_id: string; medida: string; defesa: string | null; excl_ok: boolean }[]>`
        select p.associado_id, p.medida::text, p.defesa_apresentada_em as defesa,
               exists (select 1 from gov.deliberacao d
                        where d.assembleia_id = p.assembleia_id and d.materia = 'exclusao_associado' and d.resultado = 'aprovada') as excl_ok
          from gov.processo_disciplinar p where p.id = ${id} and p.status = 'aberto'
      `;
      if (!p) throw regra('Este processo não está aberto para aplicação.');
      if (!p.defesa) throw regra('Registre antes a defesa do associado (ou que ele não se manifestou no prazo).');
      if (p.medida === 'exclusao' && !p.excl_ok) {
        throw regra('Exclusão exige deliberação aprovada de "Exclusão de associado" na assembleia ligada ao processo (Art. 8).');
      }
      await tx`
        update gov.processo_disciplinar
           set status = 'aplicada', aplicada_em = ${aplicada}, ciencia_pessoal_em = ${ciencia}
         where id = ${id}
      `;
      if (p.medida === 'suspensao') {
        await tx`update gov.associado set status = 'suspenso' where id = ${p.associado_id} and status = 'associado'`;
      } else if (p.medida === 'exclusao') {
        await tx`update gov.associado set status = 'excluido', data_saida = ${aplicada}, motivo_saida = 'Exclusão (processo disciplinar)' where id = ${p.associado_id}`;
      }
    });
  });
  voltar(`/disciplinar/${id}`, 'Medida aplicada. O prazo de recurso (5 dias da ciência pessoal) já está correndo.', erro);
}

export async function registrarRecurso(formData: FormData) {
  const u = await requirePerm('disciplinar:escrever');
  const id = idDe(formData);
  const quando = dataOuNulo(formData.get('recurso_em')) ?? hoje();
  const texto = nz(formData.get('recurso_texto'));
  const protocolado = formData.get('protocolado') === 'on';
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`
      update gov.processo_disciplinar
         set status = 'em_recurso', recurso_em = ${quando}, recurso_texto = ${texto},
             recurso_protocolado_secretaria_paroquial = ${protocolado}
       where id = ${id} and status = 'aplicada'
    `);
  });
  voltar(`/disciplinar/${id}`, 'Recurso registrado. A assembleia deve decidir em até 30 dias.', erro);
}

export async function decidirRecurso(formData: FormData) {
  const u = await requirePerm('disciplinar:escrever');
  const id = idDe(formData);
  const resultado = nz(formData.get('resultado'));
  if (resultado !== 'mantida' && resultado !== 'revogada' && resultado !== 'convertida') {
    voltar(`/disciplinar/${id}`, '', 'Escolha o resultado.');
  }
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const [p] = await tx<{ associado_id: string; medida: string; assembleia_id: string | null }[]>`
        select associado_id, medida::text, assembleia_id from gov.processo_disciplinar where id = ${id} and status = 'em_recurso'
      `;
      if (!p) throw regra('Não há recurso em andamento neste processo.');
      if (!p.assembleia_id) throw regra('Ligue antes a assembleia que decidiu o recurso.');
      await tx`update gov.processo_disciplinar set status = 'encerrada', resultado = ${resultado} where id = ${id}`;
      if (resultado === 'revogada') {
        await tx`
          update gov.associado set status = 'associado', data_saida = null, motivo_saida = null
           where id = ${p.associado_id} and status in ('suspenso','excluido')
        `;
      }
    });
  });
  voltar(`/disciplinar/${id}`, 'Recurso decidido e processo encerrado.', erro);
}

export async function encerrarSemRecurso(formData: FormData) {
  const u = await requirePerm('disciplinar:escrever');
  const id = idDe(formData);
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const r = await tx`
        update gov.processo_disciplinar set status = 'encerrada', resultado = 'mantida'
         where id = ${id} and status = 'aplicada' and prazo_recurso < current_date and recurso_em is null
        returning id
      `;
      if (r.length === 0) throw regra('Só dá para encerrar depois de vencido o prazo de 5 dias sem recurso.');
    });
  });
  voltar(`/disciplinar/${id}`, 'Processo encerrado (sem recurso no prazo).', erro);
}
