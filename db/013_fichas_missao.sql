-- 013 · A divisão de fichas pertence a uma missão (o total é definido por missão)
alter table gov.distribuicao_fichas
  add column if not exists missao_id uuid references gov.missao(id) on delete set null;
create unique index if not exists ux_distribuicao_missao on gov.distribuicao_fichas (missao_id) where missao_id is not null;
