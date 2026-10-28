-- 016 · Integração: pré-fichas por núcleo vindas de outro sistema (aba API, só superadmin)
alter table gov.nucleo add column if not exists codigo_externo text;
create unique index if not exists ux_nucleo_codigo_externo on gov.nucleo (lower(codigo_externo)) where codigo_externo is not null;

create table if not exists gov.api_sincronizacao (
  id                uuid primary key default gen_random_uuid(),
  em                timestamptz not null default now(),
  usuario_id        uuid,
  distribuicao_id   uuid references gov.distribuicao_fichas(id) on delete set null,
  status            text not null check (status in ('ok','erro')),
  recebidos         int not null default 0,
  aplicados         int not null default 0,
  sem_correspondencia text[] not null default '{}',
  erro              text
);
alter table gov.api_sincronizacao enable row level security;
