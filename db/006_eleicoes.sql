-- Governança — migração 006: eleições (Art. 16 §1, 21, 28 a 30)
-- Voto secreto: gov.urna guarda só "concordo/discordo" por candidatura, sem eleitor;
-- gov.eleitor_participacao guarda só QUEM votou (data, sem hora). A ligação entre as duas
-- é desfeita de propósito: a data é truncada para o dia e os votos entram em ordem aleatória.

-- Um único candidato vivo por cargo individual (Diretoria); o Conselho Fiscal admite vários (3+3).
create unique index ux_candidatura_cargo_unico on gov.candidatura (eleicao_id, cargo)
  where resultado <> 'rejeitado' and cargo not in ('fiscal_titular','fiscal_suplente');
create unique index ux_candidatura_pessoa_rodada on gov.candidatura (eleicao_id, rodada, associado_id);

create function gov.fn_valida_candidatura() returns trigger language plpgsql as $$
declare
  v_a gov.associado%rowtype;
  v_e gov.eleicao%rowtype;
begin
  select * into v_e from gov.eleicao where id = new.eleicao_id;
  if tg_op = 'INSERT' and v_e.status <> 'candidaturas' then
    raise exception 'A eleição não está recebendo candidaturas (situação: %)', v_e.status;
  end if;
  select * into v_a from gov.associado where id = new.associado_id;
  if v_a.status <> 'associado' then
    raise exception 'Candidatura exige associado ativo (% está com status %)', v_a.nome, v_a.status;
  end if;
  if new.cargo not in ('fiscal_titular','fiscal_suplente') and not v_a.participou_missao_senior then
    raise exception 'Art. 16 par. 1: para a Diretoria é obrigatório ter participado da missão do sênior (%)', v_a.nome;
  end if;
  if tg_op = 'INSERT' and new.rodada = 1 then
    if new.indicado_em is not null and new.indicado_em > (v_e.data_eleicao - interval '1 month')::date then
      raise exception 'Art. 29: a indicação de candidatos vai até 1 mês antes da eleição';
    end if;
    if new.apresentado_secretaria_em is not null and new.apresentado_secretaria_em > v_e.data_eleicao - 15 then
      raise exception 'Art. 29: a apresentação na secretaria vai até 15 dias antes da eleição';
    end if;
  end if;
  return new;
end $$;
create trigger trg_candidatura_valida before insert or update of associado_id, cargo on gov.candidatura
  for each row execute function gov.fn_valida_candidatura();

-- Rodada vigente = a maior rodada com candidaturas pendentes.
create function gov.rodada_atual(p_eleicao uuid) returns int language sql stable as $$
  select coalesce(max(rodada), 1) from gov.candidatura where eleicao_id = p_eleicao and resultado = 'pendente'
$$;

create function gov.registrar_voto(p_eleicao uuid, p_associado uuid, p_votos jsonb)
returns void language plpgsql as $$
declare
  v_e gov.eleicao%rowtype;
  v_rodada int;
  v_pend int;
  v_dados int;
  v_item jsonb;
begin
  select * into v_e from gov.eleicao where id = p_eleicao for update;
  if not found or v_e.status <> 'votacao' then raise exception 'A votação não está aberta'; end if;
  if not exists (select 1 from gov.associado where id = p_associado and status = 'associado') then
    raise exception 'Só associado ativo pode votar';
  end if;
  v_rodada := gov.rodada_atual(p_eleicao);
  select count(*) into v_pend from gov.candidatura where eleicao_id = p_eleicao and rodada = v_rodada and resultado = 'pendente';
  select count(distinct x->>'candidatura_id') into v_dados from jsonb_array_elements(p_votos) x
   where (x->>'candidatura_id')::uuid in (select id from gov.candidatura where eleicao_id = p_eleicao and rodada = v_rodada and resultado = 'pendente');
  if v_dados <> v_pend or jsonb_array_length(p_votos) <> v_pend then
    raise exception 'Responda "concordo" ou "discordo" para todos os candidatos';
  end if;
  begin
    insert into gov.eleitor_participacao (eleicao_id, rodada, associado_id, votou_em)
    values (p_eleicao, v_rodada, p_associado, date_trunc('day', now()));
  exception when unique_violation then
    raise exception 'Este associado já votou nesta rodada';
  end;
  for v_item in select x from jsonb_array_elements(p_votos) x order by random() loop
    insert into gov.urna (candidatura_id, concordo)
    values ((v_item->>'candidatura_id')::uuid, (v_item->>'concordo')::boolean);
  end loop;
end $$;

-- Art. 30: vence quem tiver mais "concordo" que "discordo"; senão a candidatura é rejeitada
-- e abre-se nova indicação (nova rodada) em até 15 dias.
create function gov.apurar_eleicao(p_eleicao uuid) returns void language plpgsql as $$
declare v_e gov.eleicao%rowtype; v_rodada int;
begin
  select * into v_e from gov.eleicao where id = p_eleicao for update;
  if not found or v_e.status <> 'votacao' then raise exception 'A votação não está aberta'; end if;
  v_rodada := gov.rodada_atual(p_eleicao);
  update gov.candidatura c
     set votos_concordo = x.c, votos_discordo = x.d,
         resultado = case when x.c > x.d then 'eleito' else 'rejeitado' end
    from (select ca.id,
                 count(u.id) filter (where u.concordo) as c,
                 count(u.id) filter (where not u.concordo) as d
            from gov.candidatura ca left join gov.urna u on u.candidatura_id = ca.id
           where ca.eleicao_id = p_eleicao and ca.rodada = v_rodada and ca.resultado = 'pendente'
           group by ca.id) x
   where c.id = x.id;
  update gov.eleicao set status = 'apurada' where id = p_eleicao;
end $$;

revoke all on function gov.registrar_voto(uuid, uuid, jsonb), gov.apurar_eleicao(uuid), gov.rodada_atual(uuid) from public, anon, authenticated;
grant execute on function gov.registrar_voto(uuid, uuid, jsonb), gov.apurar_eleicao(uuid), gov.rodada_atual(uuid) to service_role;
