-- Migration 004: senha própria (somente hash Argon2id), bloqueio por tentativas e log de acesso.
alter table gov.usuario
  add column if not exists senha_hash text,
  add column if not exists senha_alterada_em timestamptz,
  add column if not exists precisa_trocar_senha boolean not null default true,
  add column if not exists tentativas_falhas int not null default 0,
  add column if not exists bloqueado_ate timestamptz;

alter table gov.usuario drop constraint if exists ck_senha_so_hash;
alter table gov.usuario add constraint ck_senha_so_hash
  check (senha_hash is null or senha_hash like '$argon2id$%');

create table if not exists gov.acesso_log (
  id         bigint generated always as identity primary key,
  usuario_id uuid,
  email      text,
  sucesso    boolean not null,
  motivo     text,
  ip         text,
  user_agent text,
  em         timestamptz not null default now()
);
alter table gov.acesso_log enable row level security;
revoke all on gov.acesso_log from anon, authenticated;
grant select, insert on gov.acesso_log to service_role;

-- A auditoria nunca copia o hash da senha.
-- (função gov.fn_auditar atualizada no projeto; ver 001 para a base e aplicar com to_jsonb(old) - 'senha_hash')
