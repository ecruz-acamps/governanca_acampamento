-- 015 · Área de patrimônio do usuário (haverá vários patrimônios; só o da secretaria acessa as fichas)
alter table gov.usuario add column if not exists area_patrimonio text;
alter table gov.usuario drop constraint if exists ck_area_patrimonio_minuscula;
alter table gov.usuario add constraint ck_area_patrimonio_minuscula check (area_patrimonio is null or area_patrimonio = lower(btrim(area_patrimonio)));
