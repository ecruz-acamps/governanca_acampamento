-- Governança — migração 007: recuperação de senha por e-mail
-- Guarda só o HASH (SHA-256) do token enviado por e-mail; o token em si nunca fica no banco.
create table gov.reset_senha (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references gov.usuario(id) on delete cascade,
  token_hash  text not null unique,
  expira_em   timestamptz not null,
  usado_em    timestamptz,
  ip          text,
  criado_em   timestamptz not null default now()
);
create index ix_reset_senha_usuario on gov.reset_senha (usuario_id, criado_em desc);
alter table gov.reset_senha enable row level security;
revoke all on gov.reset_senha from anon, authenticated;
grant select, insert, update, delete on gov.reset_senha to service_role;
