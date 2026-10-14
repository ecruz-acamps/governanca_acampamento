-- 010 · Coordenadores e auxiliares de missão não precisam ser associados
-- (Art. 25/26: só a aprovação do coordenador pelo Conselho Geral continua obrigatória)

alter table gov.missao
  add column if not exists coordenador_nome text,
  add column if not exists coordenador_contato text;

-- missao_equipe: troca a chave composta por id próprio e aceita pessoa de fora
alter table gov.missao_equipe drop constraint if exists missao_equipe_pkey;
alter table gov.missao_equipe add column if not exists id uuid not null default gen_random_uuid();
alter table gov.missao_equipe add primary key (id);
alter table gov.missao_equipe alter column associado_id drop not null;
alter table gov.missao_equipe
  add column if not exists nome text,
  add column if not exists contato text;
alter table gov.missao_equipe drop constraint if exists ck_equipe_pessoa;
alter table gov.missao_equipe add constraint ck_equipe_pessoa check (associado_id is not null or nome is not null);
create unique index if not exists ux_equipe_assoc on gov.missao_equipe (missao_id, funcao, associado_id) where associado_id is not null;
create unique index if not exists ux_equipe_externo on gov.missao_equipe (missao_id, funcao, lower(nome)) where associado_id is null;

create or replace function gov.fn_valida_missao() returns trigger language plpgsql as $$
declare v_status text; v_nome text; v_tem boolean;
begin
  v_tem := new.coordenador_id is not null or new.coordenador_nome is not null;
  if new.data_inicio is not null and new.data_fim is not null and new.data_fim < new.data_inicio then
    raise exception 'O fim da missao nao pode ser anterior ao inicio';
  end if;
  if new.coordenador_id is not null and new.coordenador_nome is not null then
    raise exception 'Informe o coordenador como associado OU como pessoa de fora, nao os dois';
  end if;
  if not v_tem and new.coordenador_aprovado_em is not null then
    raise exception 'Nao ha coordenador para aprovar';
  end if;
  if new.coordenador_id is not null then
    select status::text, nome into v_status, v_nome from gov.associado where id = new.coordenador_id;
    if v_status <> 'associado' then
      raise exception 'O coordenador associado precisa estar ativo (% esta com status %)', v_nome, v_status;
    end if;
  end if;
  -- Art. 26 d: o Conselho Geral aprova os coordenadores das missoes
  if new.status in ('em_andamento','concluida') and (not v_tem or new.coordenador_aprovado_em is null) then
    raise exception 'Art. 26 d: o coordenador da missao precisa ser aprovado pelo Conselho Geral antes de iniciar';
  end if;
  -- trocar o coordenador anula a aprovacao anterior
  if tg_op = 'UPDATE'
     and (new.coordenador_id is distinct from old.coordenador_id or new.coordenador_nome is distinct from old.coordenador_nome)
     and new.coordenador_aprovado_em is not distinct from old.coordenador_aprovado_em then
    new.coordenador_aprovado_em := null;
    if new.status in ('em_andamento','concluida') then
      raise exception 'Art. 26 d: novo coordenador precisa de nova aprovacao do Conselho Geral';
    end if;
  end if;
  return new;
end $$;

create or replace function gov.fn_valida_missao_equipe() returns trigger language plpgsql as $$
declare v_status text; v_nome text;
begin
  if new.associado_id is not null and new.nome is not null then
    raise exception 'Informe o integrante como associado OU como pessoa de fora, nao os dois';
  end if;
  if new.associado_id is not null then
    select status::text, nome into v_status, v_nome from gov.associado where id = new.associado_id;
    if v_status <> 'associado' then
      raise exception 'O associado precisa estar ativo (% esta com status %)', v_nome, v_status;
    end if;
  end if;
  return new;
end $$;
