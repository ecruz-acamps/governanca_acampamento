-- 017 · Patrimônio por área: cada coordenador de patrimônio só enxerga e mexe nos bens da sua área
alter table gov.patrimonio add column if not exists area text;
alter table gov.patrimonio drop constraint if exists ck_patrimonio_area;
alter table gov.patrimonio add constraint ck_patrimonio_area check (
  area is null or area in ('manutencao','cozinha','capela','musica','teatro','animacao','farmacia','loja','comunicacao','obras','secretaria','tropa_de_elite')
);
create index if not exists ix_patrimonio_area on gov.patrimonio(area);

-- Trava no banco: coordenador de patrimônio (não superadmin) só grava bens da própria área
create or replace function gov.fn_patrimonio_area() returns trigger language plpgsql as $$
declare
  v_uid uuid := nullif(current_setting('app.user_id', true), '')::uuid;
  v_papel text; v_area text; v_super boolean;
begin
  if v_uid is null then return new; end if;
  select papel::text, area_patrimonio, superadmin into v_papel, v_area, v_super from gov.usuario where id = v_uid;
  if v_papel = 'coord_patrimonio' and not coalesce(v_super, false) then
    if v_area is null or lower(btrim(v_area)) <> coalesce(new.area, '')
       or (tg_op = 'UPDATE' and lower(btrim(v_area)) <> coalesce(old.area, '')) then
      raise exception 'Coordenador de patrimonio so pode registrar e alterar bens da propria area';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_patrimonio_area on gov.patrimonio;
create trigger trg_patrimonio_area before insert or update on gov.patrimonio
  for each row execute function gov.fn_patrimonio_area();
