-- 008 · Conselho Geral e missões (Art. 25 e 26)
set search_path = gov, public;

-- um associado só pode ter uma designação aberta no Conselho Geral
create unique index if not exists ux_conselho_membro_aberto
  on gov.conselho_geral_membro (associado_id) where encerrado_em is null;

create or replace function gov.fn_valida_conselho_membro() returns trigger language plpgsql as $$
declare v_status text; v_nome text;
begin
  select status::text, nome into v_status, v_nome from gov.associado where id = new.associado_id;
  if new.encerrado_em is null and v_status <> 'associado' then
    raise exception 'Art. 26: o Conselho Geral e formado por associados ativos (% esta com status %)', v_nome, v_status;
  end if;
  if new.encerrado_em is not null and new.encerrado_em < new.designado_em then
    raise exception 'A data de encerramento nao pode ser anterior a designacao';
  end if;
  return new;
end $$;
drop trigger if exists trg_conselho_membro_valida on gov.conselho_geral_membro;
create trigger trg_conselho_membro_valida before insert or update on gov.conselho_geral_membro
  for each row execute function gov.fn_valida_conselho_membro();

create or replace function gov.fn_valida_missao() returns trigger language plpgsql as $$
declare v_status text; v_nome text;
begin
  if new.data_inicio is not null and new.data_fim is not null and new.data_fim < new.data_inicio then
    raise exception 'O fim da missao nao pode ser anterior ao inicio';
  end if;
  if new.coordenador_id is null and new.coordenador_aprovado_em is not null then
    raise exception 'Nao ha coordenador para aprovar';
  end if;
  if new.coordenador_id is not null then
    select status::text, nome into v_status, v_nome from gov.associado where id = new.coordenador_id;
    if v_status <> 'associado' then
      raise exception 'O coordenador precisa ser associado ativo (% esta com status %)', v_nome, v_status;
    end if;
  end if;
  -- Art. 26 d: o Conselho Geral aprova os coordenadores das missoes
  if new.status in ('em_andamento','concluida') and (new.coordenador_id is null or new.coordenador_aprovado_em is null) then
    raise exception 'Art. 26 d: o coordenador da missao precisa ser aprovado pelo Conselho Geral antes de iniciar';
  end if;
  -- trocar o coordenador anula a aprovacao anterior
  if tg_op = 'UPDATE' and new.coordenador_id is distinct from old.coordenador_id
     and new.coordenador_aprovado_em is not distinct from old.coordenador_aprovado_em then
    new.coordenador_aprovado_em := null;
    if new.status in ('em_andamento','concluida') then
      raise exception 'Art. 26 d: novo coordenador precisa de nova aprovacao do Conselho Geral';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_missao_valida on gov.missao;
create trigger trg_missao_valida before insert or update on gov.missao
  for each row execute function gov.fn_valida_missao();

create or replace function gov.fn_valida_missao_equipe() returns trigger language plpgsql as $$
declare v_status text; v_nome text;
begin
  select status::text, nome into v_status, v_nome from gov.associado where id = new.associado_id;
  if v_status <> 'associado' then
    raise exception 'A equipe da missao so aceita associados ativos (% esta com status %)', v_nome, v_status;
  end if;
  return new;
end $$;
drop trigger if exists trg_missao_equipe_valida on gov.missao_equipe;
create trigger trg_missao_equipe_valida before insert or update on gov.missao_equipe
  for each row execute function gov.fn_valida_missao_equipe();

-- auditoria (missao_equipe nao tem coluna id; o registro_id fica nulo, o conteudo vai em antes/depois)
do $$ declare t text; begin
  foreach t in array array['conselho_geral_membro','missao','missao_equipe'] loop
    if not exists (select 1 from pg_trigger where tgname = 'trg_'||t||'_audit') then
      execute format('create trigger trg_%1$s_audit after insert or update or delete on gov.%1$s
         for each row execute function gov.fn_auditar()', t);
    end if;
  end loop;
end $$;
