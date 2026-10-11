'use server';

import { redirect } from 'next/navigation';
import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { dataOuNulo, flag, isUuid, nz } from '@/lib/form';
import { REUNIAO_LABEL } from '@/lib/format';
import { requirePerm } from '@/lib/session';

export async function criarReuniao(formData: FormData) {
  const u = await requirePerm('reunioes:escrever');
  const tipo = nz(formData.get('tipo'));
  const data = dataOuNulo(formData.get('data'));
  if (!tipo || !(tipo in REUNIAO_LABEL)) voltar('/reunioes', '', 'Escolha o tipo da reunião.');
  if (!data) voltar('/reunioes', '', 'Informe a data.');
  let novoId: string | null = null;
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const [r] = await tx<{ id: string }[]>`
        insert into gov.reuniao (tipo, data, titulo, local, pauta, conta_presenca)
        values (${tipo}, ${data}, ${nz(formData.get('titulo'))}, ${nz(formData.get('local'))},
                ${nz(formData.get('pauta'))}, ${flag(formData.get('conta_presenca'))})
        returning id
      `;
      novoId = r.id;
    });
  });
  if (erro) voltar('/reunioes', '', erro);
  redirect(`/reunioes/${novoId}?ok=` + encodeURIComponent('Reunião criada. Marque quem esteve presente.'));
}

export async function salvarPresenca(formData: FormData) {
  const u = await requirePerm('reunioes:escrever');
  const reuniaoId = nz(formData.get('reuniao_id'));
  if (!isUuid(reuniaoId)) redirect('/reunioes');
  const caminho = `/reunioes/${reuniaoId}`;
  const ids = formData.getAll('assoc').map(String).filter(isUuid);

  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      for (const aid of ids) {
        const presente = formData.get(`p_${aid}`) === 'on';
        const just = nz(formData.get(`j_${aid}`));
        await tx`
          insert into gov.presenca (reuniao_id, associado_id, presente, justificativa)
          values (${reuniaoId}, ${aid}, ${presente}, ${presente ? null : just})
          on conflict (reuniao_id, associado_id)
          do update set presente = excluded.presente, justificativa = excluded.justificativa
        `;
      }
    });
  });
  voltar(caminho, 'Presenças salvas.', erro);
}

export async function excluirReuniao(formData: FormData) {
  const u = await requirePerm('reunioes:escrever');
  const id = nz(formData.get('id'));
  if (!isUuid(id)) redirect('/reunioes');
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`delete from gov.reuniao where id = ${id}`);
  });
  if (erro) voltar(`/reunioes/${id}`, '', erro);
  voltar('/reunioes', 'Reunião excluída.');
}
