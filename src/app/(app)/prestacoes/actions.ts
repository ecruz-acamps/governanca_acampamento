'use server';

import { redirect } from 'next/navigation';
import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { dataOuNulo, inteiroOuNulo, isUuid, nz } from '@/lib/form';
import { hoje, PRESTACAO_TIPO_LABEL } from '@/lib/format';
import { requirePerm } from '@/lib/session';

const regra = (t: string) => Object.assign(new Error(t), { code: 'P0001' });

function idDe(formData: FormData): string {
  const id = nz(formData.get('id'));
  if (!isUuid(id)) redirect('/prestacoes');
  return id;
}

export async function criarPrestacao(formData: FormData) {
  const u = await requirePerm('financeiro:escrever');
  const tipo = nz(formData.get('tipo'));
  const ini = dataOuNulo(formData.get('periodo_inicio'));
  const fim = dataOuNulo(formData.get('periodo_fim'));
  if (!tipo || !(tipo in PRESTACAO_TIPO_LABEL)) voltar('/prestacoes', '', 'Escolha o tipo.');
  if (!ini || !fim) voltar('/prestacoes', '', 'Informe o período.');
  if (fim < ini) voltar('/prestacoes', '', 'O fim do período não pode ser antes do início.');
  const exercicio = inteiroOuNulo(formData.get('exercicio')) ?? Number(fim.slice(0, 4));
  let novo: string | null = null;
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const [r] = await tx<{ id: string }[]>`
        insert into gov.prestacao_contas (tipo, exercicio, periodo_inicio, periodo_fim)
        values (${tipo}, ${exercicio}, ${ini}, ${fim}) returning id
      `;
      novo = r.id;
    });
  });
  if (erro) voltar('/prestacoes', '', erro);
  redirect(`/prestacoes/${novo}?ok=` + encodeURIComponent('Prestação criada como rascunho.'));
}

export async function emitirPrestacao(formData: FormData) {
  const u = await requirePerm('financeiro:escrever');
  const id = idDe(formData);
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const r = await tx`update gov.prestacao_contas set status = 'emitido' where id = ${id} and status = 'rascunho' returning id`;
      if (r.length === 0) throw regra('Só dá para emitir uma prestação em rascunho.');
    });
  });
  voltar(`/prestacoes/${id}`, 'Prestação emitida. Falta o parecer do Conselho Fiscal.', erro);
}

export async function registrarParecer(formData: FormData) {
  const u = await requirePerm('parecer:escrever');
  const id = idDe(formData);
  const resultado = nz(formData.get('resultado'));
  const texto = nz(formData.get('texto'));
  const quando = dataOuNulo(formData.get('data')) ?? hoje();
  if (resultado !== 'aprovado' && resultado !== 'aprovado_com_ressalvas' && resultado !== 'reprovado') {
    voltar(`/prestacoes/${id}`, '', 'Escolha o resultado do parecer.');
  }
  if (resultado !== 'aprovado' && !texto) voltar(`/prestacoes/${id}`, '', 'Explique as ressalvas ou os motivos da reprovação.');
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const r = await tx`
        update gov.prestacao_contas
           set status = 'com_parecer_cf', parecer_cf_resultado = ${resultado}, parecer_cf_texto = ${texto}, parecer_cf_em = ${quando}
         where id = ${id} and status in ('emitido','com_parecer_cf') returning id
      `;
      if (r.length === 0) throw regra('O parecer só pode ser dado depois que a prestação for emitida.');
    });
  });
  voltar(`/prestacoes/${id}`, 'Parecer do Conselho Fiscal registrado.', erro);
}

export async function aprovarEmAssembleia(formData: FormData) {
  const u = await requirePerm('financeiro:escrever');
  const id = idDe(formData);
  const ass = nz(formData.get('assembleia_id'));
  if (!isUuid(ass)) voltar(`/prestacoes/${id}`, '', 'Escolha a assembleia.');
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const [p] = await tx<{ tipo: string; status: string; parecer: string | null }[]>`
        select tipo, status, parecer_cf_resultado as parecer from gov.prestacao_contas where id = ${id}
      `;
      if (!p || p.status !== 'com_parecer_cf') throw regra('A prestação precisa ter o parecer do Conselho Fiscal antes de ir à assembleia.');
      if (p.parecer === 'reprovado') throw regra('Parecer reprovado: corrija a prestação e peça novo parecer antes de levar à assembleia.');
      if (p.tipo === 'balancete_anual') {
        const [d] = await tx<{ ok: boolean }[]>`
          select exists (select 1 from gov.deliberacao where assembleia_id = ${ass} and materia = 'contas_anuais' and resultado = 'aprovada') as ok
        `;
        if (!d.ok) throw regra('A assembleia escolhida não tem deliberação aprovada de "Contas anuais" (Art. 11, I).');
      }
      await tx`
        update gov.prestacao_contas set status = 'aprovado_em_assembleia', apresentado_assembleia_id = ${ass} where id = ${id}
      `;
    });
  });
  voltar(`/prestacoes/${id}`, 'Prestação aprovada em assembleia.', erro);
}
