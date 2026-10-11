'use server';

import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { dataOuNulo, isUuid, nz } from '@/lib/form';
import { CARGO_LABEL, hoje } from '@/lib/format';
import { requirePerm } from '@/lib/session';

export async function criarCiclo(formData: FormData) {
  const u = await requirePerm('mandatos:escrever');
  const inicio = dataOuNulo(formData.get('inicio'));
  if (!inicio) voltar('/mandatos', '', 'Informe a data de início.');
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`
      insert into gov.ciclo_mandato (inicio, fim)
      values (${inicio}, (${inicio}::date + interval '3 years' - interval '1 day')::date)
    `);
  });
  voltar('/mandatos', 'Ciclo de 3 anos criado.', erro);
}

export async function empossar(formData: FormData) {
  const u = await requirePerm('mandatos:escrever');
  const ciclo = nz(formData.get('ciclo_id'));
  const assoc = nz(formData.get('associado_id'));
  const cargo = nz(formData.get('cargo'));
  if (!isUuid(ciclo) || !isUuid(assoc) || !cargo || !(cargo in CARGO_LABEL)) {
    voltar('/mandatos', '', 'Escolha o ciclo, o associado e o cargo.');
  }
  const inicio = dataOuNulo(formData.get('inicio'));
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`
      insert into gov.mandato (ciclo_id, associado_id, cargo, inicio, fim)
      select c.id, ${assoc}, ${cargo}, greatest(c.inicio, coalesce(${inicio}::date, c.inicio)), c.fim
        from gov.ciclo_mandato c where c.id = ${ciclo}
    `);
  });
  voltar('/mandatos', 'Mandato registrado.', erro);
}

export async function encerrarMandato(formData: FormData) {
  const u = await requirePerm('mandatos:escrever');
  const id = nz(formData.get('id'));
  if (!isUuid(id)) voltar('/mandatos', '', 'Mandato inválido.');
  const motivo = nz(formData.get('motivo'));
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`
      update gov.mandato
         set situacao = 'encerrado', motivo_encerramento = ${motivo ?? 'Encerrado em ' + hoje()}
       where id = ${id} and situacao = 'ativo'
    `);
  });
  voltar('/mandatos', 'Mandato encerrado. Para vacância, registre o substituto (Art. 16 §3).', erro);
}
