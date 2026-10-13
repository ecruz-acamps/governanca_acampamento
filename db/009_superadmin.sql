-- 009 · Superadmin: único que apaga usuários e reinicia o sistema
alter table gov.usuario add column if not exists superadmin boolean not null default false;

-- só pode existir um superadmin
create unique index if not exists ux_usuario_superadmin on gov.usuario ((true)) where superadmin;

update gov.usuario set superadmin = true, papel = 'admin', ativo = true
 where email = 'superadmin@acampamentosaopadrepio.com.br';

-- o marcador de superadmin só muda direto no banco (SQL Editor), nunca pela aplicação
create or replace function gov.fn_protege_superadmin() returns trigger language plpgsql as $$
declare v_uid uuid := nullif(current_setting('app.user_id', true), '')::uuid;
begin
  if tg_op = 'DELETE' then
    if old.superadmin then
      raise exception 'O superadmin nao pode ser apagado';
    end if;
    if v_uid is not null and not exists (select 1 from gov.usuario where id = v_uid and superadmin and ativo) then
      raise exception 'Somente o superadmin pode apagar usuarios';
    end if;
    return old;
  end if;
  if new.superadmin is distinct from old.superadmin and v_uid is not null then
    raise exception 'O marcador de superadmin so pode ser alterado direto no banco';
  end if;
  if old.superadmin and v_uid is not null and v_uid <> old.id then
    raise exception 'Somente o proprio superadmin pode alterar esta conta';
  end if;
  return new;
end $$;
drop trigger if exists trg_usuario_protege_superadmin on gov.usuario;
create trigger trg_usuario_protege_superadmin before update or delete on gov.usuario
  for each row execute function gov.fn_protege_superadmin();

-- Reinicia a operação: apaga todos os dados, mantém só o superadmin e as tabelas de referência
create or replace function gov.resetar_sistema(p_id uuid) returns void
language plpgsql security definer set search_path = gov, public as $$
declare v_lista text;
begin
  if not exists (select 1 from gov.usuario where id = p_id and superadmin and ativo) then
    raise exception 'Somente o superadmin pode reiniciar o sistema';
  end if;
  create temp table _sa on commit drop as select * from gov.usuario where id = p_id;
  update _sa set associado_id = null, tentativas_falhas = 0, bloqueado_ate = null;

  select string_agg(format('gov.%I', tablename), ', ') into v_lista
    from pg_tables where schemaname = 'gov' and tablename <> 'obrigacao_modelo';
  execute 'truncate table ' || v_lista || ' restart identity';

  insert into gov.usuario select * from _sa;
  insert into gov.auditoria (tabela, registro_id, operacao, depois, usuario)
  values ('sistema', null, 'RESET', jsonb_build_object('motivo', 'reinicio da operacao'), p_id::text);
end $$;
revoke all on function gov.resetar_sistema(uuid) from public, anon, authenticated;
