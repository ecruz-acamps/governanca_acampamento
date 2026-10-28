'use server';

import { redirect } from 'next/navigation';
import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { isUuid, nz } from '@/lib/form';
import { buscarPreFichas, casar, type NucleoBanco } from '@/lib/prefichas';
import { requireSuperadmin } from '@/lib/session';

const R = '/integracao-api';

export async function salvarCodigoNucleo(formData: FormData) {
  const u = await requireSuperadmin();
  const id = nz(formData.get('id'));
  const d = nz(formData.get('d'));
  const volta = d && isUuid(d) ? `${R}?d=${d}` : R;
  if (!isUuid(id)) redirect(volta);
  const codigo = nz(formData.get('codigo'));
  const erro = await tentar(() => run(u.id, async (tx) => {
    await tx`update gov.nucleo set codigo_externo = ${codigo} where id = ${id}`;
  }));
  voltar(volta, 'Código do núcleo salvo.', erro);
}

/** Busca de novo na API (nunca confia no que a tela mostrou) e grava as pré-fichas na distribuição. */
export async function aplicarPrefichas(formData: FormData) {
  const u = await requireSuperadmin();
  const d = nz(formData.get('d'));
  if (!isUuid(d)) voltar(R, '', 'Escolha a distribuição de fichas.');
  const volta = `${R}?d=${d}`;

  const resp = await buscarPreFichas();
  if (!resp.ok) {
    await run(u.id, (tx) => tx`
      insert into gov.api_sincronizacao (usuario_id, distribuicao_id, status, erro) values (${u.id}, ${d}, 'erro', ${resp.erro})`);
    voltar(volta, '', resp.erro);
  }
  const erro = await tentar(() => run(u.id, async (tx) => {
    const nucleos = await tx<NucleoBanco[]>`select id, nome, codigo_externo from gov.nucleo where ativo`;
    const c = casar(nucleos, resp.itens);
    for (const { nucleo, item } of c.ligados) {
      await tx`
        insert into gov.distribuicao_pre (distribuicao_id, nucleo_id, pre_fichas, pre_fora)
        values (${d}, ${nucleo.id}, ${item.pre_fichas}, ${item.pre_fora})
        on conflict (distribuicao_id, nucleo_id) do update set pre_fichas = excluded.pre_fichas, pre_fora = excluded.pre_fora`;
    }
    const sem = c.semCorrespondencia.map((i) => i.codigo ?? i.nome ?? '?');
    await tx`
      insert into gov.api_sincronizacao (usuario_id, distribuicao_id, status, recebidos, aplicados, sem_correspondencia)
      values (${u.id}, ${d}, 'ok', ${resp.itens.length}, ${c.ligados.length}, ${tx.array(sem)})`;
  }));
  voltar(volta, 'Pré-fichas atualizadas a partir da API. Veja o resultado em Fichas por núcleo.', erro);
}
