'use server';

import { redirect } from 'next/navigation';
import { tentar, voltar } from '@/lib/acao';
import { run } from '@/lib/db';
import { dataOuNulo, inteiroOuNulo, isUuid, nz } from '@/lib/form';
import { CANAIS, CONVOCADA_POR_LABEL, MATERIA_LABEL } from '@/lib/format';
import { requirePerm } from '@/lib/session';

export async function criarAssembleia(formData: FormData) {
  const u = await requirePerm('assembleias:escrever');
  const tipo = nz(formData.get('tipo'));
  const por = nz(formData.get('convocada_por'));
  const titulo = nz(formData.get('titulo'));
  const conv = dataOuNulo(formData.get('data_convocacao'));
  const real = dataOuNulo(formData.get('data_realizacao'));
  const numero = inteiroOuNulo(formData.get('convocacao_numero')) ?? 1;
  if (tipo !== 'AGO' && tipo !== 'AGE') voltar('/assembleias', '', 'Escolha o tipo (AGO ou AGE).');
  if (!por || !(por in CONVOCADA_POR_LABEL)) voltar('/assembleias', '', 'Informe quem convocou.');
  if (!titulo) voltar('/assembleias', '', 'Informe o título.');
  if (!conv || !real) voltar('/assembleias', '', 'Informe as datas de convocação e de realização.');
  if (numero < 1 || numero > 3) voltar('/assembleias', '', 'A convocação é a 1ª, 2ª ou 3ª.');
  const canais = formData.getAll('canais').map(String).filter((c) => (CANAIS as readonly string[]).includes(c));

  let novoId: string | null = null;
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const [r] = await tx<{ id: string }[]>`
        insert into gov.assembleia
          (tipo, titulo, convocada_por, data_convocacao, data_realizacao, canais_divulgacao, convocacao_numero, associados_aptos)
        values
          (${tipo}, ${titulo}, ${por}, ${conv}, ${real}, ${tx.array(canais)}, ${numero},
           (select count(*)::int from gov.associado where status = 'associado'))
        returning id
      `;
      novoId = r.id;
    });
  });
  if (erro) voltar('/assembleias', '', erro);
  redirect(`/assembleias/${novoId}?ok=` + encodeURIComponent('Assembleia convocada. Registre a presença no dia.'));
}

export async function salvarPresencaAssembleia(formData: FormData) {
  const u = await requirePerm('assembleias:escrever');
  const id = nz(formData.get('assembleia_id'));
  if (!isUuid(id)) redirect('/assembleias');
  const ids = formData.getAll('assoc').map(String).filter(isUuid);
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      for (const aid of ids) {
        if (formData.get(`p_${aid}`) === 'on') {
          const mod = formData.get(`m_${aid}`) === 'remota' ? 'remota' : 'presencial';
          await tx`
            insert into gov.assembleia_presenca (assembleia_id, associado_id, modalidade)
            values (${id}, ${aid}, ${mod})
            on conflict (assembleia_id, associado_id) do update set modalidade = excluded.modalidade
          `;
        } else {
          await tx`delete from gov.assembleia_presenca where assembleia_id = ${id} and associado_id = ${aid}`;
        }
      }
      await tx`
        update gov.assembleia set presentes =
          (select count(*)::int from gov.assembleia_presenca where assembleia_id = ${id})
         where id = ${id}
      `;
    });
  });
  voltar(`/assembleias/${id}`, 'Presenças da assembleia salvas.', erro);
}

/** Confere o quórum de instalação (Art. 11 e 13) e instala ou declara sem quórum. */
export async function instalarAssembleia(formData: FormData) {
  const u = await requirePerm('assembleias:escrever');
  const id = nz(formData.get('id'));
  if (!isUuid(id)) redirect('/assembleias');
  let texto = '';
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const [r] = await tx<{ ok: boolean | null }[]>`
        update gov.assembleia a
           set status = case when gov.quorum_instalacao(a.tipo, a.convocacao_numero, coalesce(a.associados_aptos, 0), coalesce(a.presentes, 0))
                             then 'instalada' else 'sem_quorum' end
         where a.id = ${id} and a.status = 'convocada'
        returning (a.status = 'instalada') as ok
      `;
      texto = !r ? 'A assembleia já foi instalada ou encerrada.'
        : r.ok ? 'Quórum atingido: assembleia instalada.'
        : 'Quórum NÃO atingido: registrada como "sem quórum". Convoque a próxima convocação.';
    });
  });
  voltar(`/assembleias/${id}`, texto, erro);
}

export async function encerrarAssembleia(formData: FormData) {
  const u = await requirePerm('assembleias:escrever');
  const id = nz(formData.get('id'));
  const acao = nz(formData.get('acao'));
  if (!isUuid(id) || (acao !== 'realizada' && acao !== 'cancelada')) redirect('/assembleias');
  const erro = await tentar(async () => {
    await run(u.id, (tx) => tx`
      update gov.assembleia set status = ${acao}
       where id = ${id} and status in ('convocada','instalada')
    `);
  });
  voltar(`/assembleias/${id}`, acao === 'realizada' ? 'Assembleia encerrada.' : 'Assembleia cancelada.', erro);
}

export async function adicionarDeliberacao(formData: FormData) {
  const u = await requirePerm('assembleias:escrever');
  const id = nz(formData.get('assembleia_id'));
  if (!isUuid(id)) redirect('/assembleias');
  const caminho = `/assembleias/${id}`;
  const materia = nz(formData.get('materia'));
  const descricao = nz(formData.get('descricao'));
  const favor = inteiroOuNulo(formData.get('votos_favor')) ?? 0;
  const contra = inteiroOuNulo(formData.get('votos_contra')) ?? 0;
  const abst = inteiroOuNulo(formData.get('abstencoes')) ?? 0;
  const qualidade = formData.get('voto_qualidade') === 'on';
  const desempate = nz(formData.get('resultado_empate'));
  if (!materia || !(materia in MATERIA_LABEL)) voltar(caminho, '', 'Escolha a matéria.');
  if (!descricao) voltar(caminho, '', 'Descreva o que foi votado.');

  let aviso = '';
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const [a] = await tx<{ status: string; presentes: number | null; aptos: number | null }[]>`
        select status, presentes, associados_aptos as aptos from gov.assembleia where id = ${id}
      `;
      if (!a) throw Object.assign(new Error('Assembleia não encontrada.'), { code: 'P0001' });
      if (!['instalada', 'realizada'].includes(a.status)) {
        throw Object.assign(new Error('Só se pode deliberar em assembleia instalada (confira o quórum primeiro).'), { code: 'P0001' });
      }
      const presentes = a.presentes ?? 0;
      if (favor + contra + abst > presentes) {
        throw Object.assign(new Error(`Os votos (${favor + contra + abst}) superam os presentes (${presentes}).`), { code: 'P0001' });
      }
      let resultado: 'aprovada' | 'rejeitada';
      if (favor === contra && qualidade && (desempate === 'aprovada' || desempate === 'rejeitada')) {
        resultado = desempate; // voto de qualidade do presidente (Art. 15)
      } else {
        const [m] = await tx<{ ok: boolean }[]>`
          select gov.maioria_ok(${materia}::gov.materia, ${favor}, ${contra}, ${presentes}, ${a.aptos ?? 0}) as ok
        `;
        resultado = m.ok ? 'aprovada' : 'rejeitada';
      }
      await tx`
        insert into gov.deliberacao (assembleia_id, materia, descricao, votos_favor, votos_contra, abstencoes, voto_qualidade, resultado)
        values (${id}, ${materia}, ${descricao}, ${favor}, ${contra}, ${abst}, ${qualidade && favor === contra}, ${resultado})
      `;
      if (qualidade && favor === contra) {
        await tx`update gov.assembleia set voto_qualidade_usado = true where id = ${id}`;
      }
      aviso = resultado === 'aprovada' ? 'Deliberação registrada: APROVADA.' : 'Deliberação registrada: REJEITADA.';
    });
  });
  voltar(caminho, aviso, erro);
}

/** Liga uma deliberação aprovada de admissão ao associado proposto (Art. 7, n). */
export async function vincularAdmissao(formData: FormData) {
  const u = await requirePerm('assembleias:escrever');
  const idAss = nz(formData.get('assembleia_id'));
  const delib = nz(formData.get('deliberacao_id'));
  const assoc = nz(formData.get('associado_id'));
  if (!isUuid(idAss)) redirect('/assembleias');
  if (!isUuid(delib) || !isUuid(assoc)) voltar(`/assembleias/${idAss}`, '', 'Escolha o associado.');
  const erro = await tentar(async () => {
    await run(u.id, async (tx) => {
      const r = await tx`
        update gov.associado set admissao_deliberacao_id = ${delib}
         where id = ${assoc}
           and exists (select 1 from gov.deliberacao d
                        where d.id = ${delib} and d.materia = 'admissao_associado' and d.resultado = 'aprovada')
        returning id
      `;
      if (r.length === 0) throw Object.assign(new Error('Só dá para vincular uma deliberação aprovada de admissão.'), { code: 'P0001' });
    });
  });
  voltar(`/assembleias/${idAss}`, 'Aprovação ligada ao associado. Agora ele pode ser admitido.', erro);
}
