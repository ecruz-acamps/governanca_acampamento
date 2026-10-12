'use server';

import { redirect } from 'next/navigation';
import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { dataOuNulo, inteiroOuNulo, isUuid, nz } from '@/lib/form';
import { CARGO_LABEL } from '@/lib/format';
import { requireUser, requirePerm } from '@/lib/session';

const regra = (t: string) => Object.assign(new Error(t), { code: 'P0001' });

function idDe(formData: FormData): string {
  const id = nz(formData.get('id'));
  if (!isUuid(id)) redirect('/eleicoes');
  return id;
}

export async function criarEleicao(formData: FormData) {
  const u = await requirePerm('eleicoes:escrever');
  const data = dataOuNulo(formData.get('data_eleicao'));
  if (!data) voltar('/eleicoes', '', 'Informe a data da eleição.');
  const ano = inteiroOuNulo(formData.get('ano')) ?? Number(data.slice(0, 4));
  let novo: string | null = null;
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const [r] = await tx<{ id: string }[]>`insert into gov.eleicao (ano, data_eleicao) values (${ano}, ${data}) returning id`;
      novo = r.id;
    });
  });
  if (erro) voltar('/eleicoes', '', erro);
  redirect(`/eleicoes/${novo}?ok=` + encodeURIComponent('Eleição criada.'));
}

export async function abrirCandidaturas(formData: FormData) {
  const u = await requirePerm('eleicoes:escrever');
  const id = idDe(formData);
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const r = await tx`update gov.eleicao set status = 'candidaturas' where id = ${id} and status in ('planejada','apurada') returning id`;
      if (r.length === 0) throw regra('Não dá para abrir candidaturas nesta situação.');
    });
  });
  voltar(`/eleicoes/${id}`, 'Candidaturas abertas.', erro);
}

export async function adicionarCandidatura(formData: FormData) {
  const u = await requirePerm('eleicoes:escrever');
  const id = idDe(formData);
  const assoc = nz(formData.get('associado_id'));
  const cargo = nz(formData.get('cargo'));
  if (!isUuid(assoc) || !cargo || !(cargo in CARGO_LABEL)) voltar(`/eleicoes/${id}`, '', 'Escolha o associado e o cargo.');
  const indicado = dataOuNulo(formData.get('indicado_em'));
  const apresentado = dataOuNulo(formData.get('apresentado_secretaria_em'));
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const [{ r }] = await tx<{ r: number }[]>`
        select coalesce(max(rodada), 1)::int as r from gov.candidatura where eleicao_id = ${id}
      `;
      const [{ pend }] = await tx<{ pend: number }[]>`
        select count(*)::int as pend from gov.candidatura where eleicao_id = ${id} and rodada = ${r} and resultado <> 'pendente'
      `;
      // Se a rodada mais recente já foi apurada, os novos candidatos abrem a rodada seguinte (Art. 30, parágrafo único).
      const [{ total }] = await tx<{ total: number }[]>`
        select count(*)::int as total from gov.candidatura where eleicao_id = ${id} and rodada = ${r}
      `;
      const rodada = total > 0 && pend === total ? r + 1 : r;
      await tx`
        insert into gov.candidatura (eleicao_id, associado_id, cargo, rodada, indicado_em, apresentado_secretaria_em)
        values (${id}, ${assoc}, ${cargo}, ${rodada}, ${indicado}, ${apresentado})
      `;
    });
  });
  voltar(`/eleicoes/${id}`, 'Candidatura registrada.', erro);
}

export async function removerCandidatura(formData: FormData) {
  const u = await requirePerm('eleicoes:escrever');
  const id = idDe(formData);
  const cand = nz(formData.get('candidatura_id'));
  if (!isUuid(cand)) voltar(`/eleicoes/${id}`, '', 'Candidatura inválida.');
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const r = await tx`
        delete from gov.candidatura c using gov.eleicao e
         where c.id = ${cand} and c.eleicao_id = e.id and e.id = ${id} and e.status = 'candidaturas' and c.resultado = 'pendente' returning c.id
      `;
      if (r.length === 0) throw regra('Só dá para retirar candidatura pendente enquanto as candidaturas estão abertas.');
    });
  });
  voltar(`/eleicoes/${id}`, 'Candidatura retirada.', erro);
}

export async function abrirVotacao(formData: FormData) {
  const u = await requirePerm('eleicoes:escrever');
  const id = idDe(formData);
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from gov.candidatura where eleicao_id = ${id} and resultado = 'pendente'`;
      if (n === 0) throw regra('Cadastre ao menos um candidato antes de abrir a votação.');
      const r = await tx`update gov.eleicao set status = 'votacao' where id = ${id} and status = 'candidaturas' returning id`;
      if (r.length === 0) throw regra('A votação só abre depois da fase de candidaturas.');
    });
  });
  voltar(`/eleicoes/${id}`, 'Votação aberta. Cada associado vota uma única vez, em sigilo.', erro);
}

/** Voto secreto: a urna guarda só "concordo/discordo"; quem votou fica em outra tabela, sem ligação. */
export async function votar(formData: FormData) {
  const u = await requireUser();
  const id = idDe(formData);
  // Associado vota pelo portal; a equipe, pela tela da eleição.
  const retorno = nz(formData.get('retorno'));
  const volta = retorno && /^\/portal(\/[a-z0-9-]*)*$/.test(retorno) ? retorno : `/eleicoes/${id}`;
  const votos: { candidatura_id: string; concordo: boolean }[] = [];
  for (const [k, v] of formData.entries()) {
    if (!k.startsWith('v_')) continue;
    const cid = k.slice(2);
    if (!isUuid(cid) || (v !== 'concordo' && v !== 'discordo')) continue;
    votos.push({ candidatura_id: cid, concordo: v === 'concordo' });
  }
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const [a] = await tx<{ associado_id: string | null }[]>`select associado_id from gov.usuario where id = ${u.id}`;
      if (!a?.associado_id) throw regra('Sua conta não está ligada a um associado, por isso não pode votar.');
      await tx`select gov.registrar_voto(${id}::uuid, ${a.associado_id}::uuid, ${JSON.stringify(votos)}::jsonb)`;
    });
  });
  voltar(volta, 'Voto registrado. Obrigado!', erro);
}

export async function apurar(formData: FormData) {
  const u = await requirePerm('eleicoes:escrever');
  const id = idDe(formData);
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`select gov.apurar_eleicao(${id}::uuid)`);
  });
  voltar(`/eleicoes/${id}`, 'Votação apurada.', erro);
}

export async function empossarEleitos(formData: FormData) {
  const u = await requirePerm('eleicoes:escrever');
  const id = idDe(formData);
  const inicio = dataOuNulo(formData.get('inicio'));
  if (!inicio) voltar(`/eleicoes/${id}`, '', 'Informe a data de início do mandato.');
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const [e] = await tx<{ status: string }[]>`select status from gov.eleicao where id = ${id} for update`;
      if (!e || e.status !== 'apurada') throw regra('A posse só vale para eleição apurada.');
      const [{ pend, eleitos }] = await tx<{ pend: number; eleitos: number }[]>`
        select count(*) filter (where resultado = 'pendente')::int as pend, count(*) filter (where resultado = 'eleito')::int as eleitos
          from gov.candidatura where eleicao_id = ${id}
      `;
      if (pend > 0) throw regra('Ainda há candidatos pendentes.');
      if (eleitos === 0) throw regra('Não há eleitos para empossar.');
      // Mandato de 3 anos (Art. 16 §2 e Art. 21 §2).
      const [c] = await tx<{ id: string }[]>`
        insert into gov.ciclo_mandato (inicio, fim) values (${inicio}::date, (${inicio}::date + interval '3 years')::date) returning id
      `;
      await tx`
        insert into gov.mandato (ciclo_id, associado_id, cargo, inicio, fim)
        select ${c.id}, ca.associado_id, ca.cargo, ${inicio}::date, (${inicio}::date + interval '3 years')::date
          from gov.candidatura ca where ca.eleicao_id = ${id} and ca.resultado = 'eleito'
      `;
      await tx`update gov.eleicao set status = 'empossada', ciclo_id = ${c.id} where id = ${id}`;
    });
  });
  voltar(`/eleicoes/${id}`, 'Eleitos empossados. Os mandatos aparecem em Mandatos.', erro);
}
