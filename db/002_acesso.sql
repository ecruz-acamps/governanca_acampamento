-- =====================================================================
-- Governança — migração 002: acesso, papéis e permissões
-- Rodar DEPOIS de governanca.sql, no projeto Supabase novo da Governança.
--
-- Modelo de acesso:
--  * O app (Next.js na Vercel) conecta direto ao Postgres pelo pooler do
--    Supabase (porta 6543, modo transação) e faz o controle de papéis (RBAC).
--  * anon e authenticated NÃO enxergam nada do schema gov.
--  * Storage: bucket privado, acessado só pelo servidor (service role).
-- =====================================================================

-- ---------------------------------------------------------------------
-- PAPÉIS E USUÁRIOS (liga o login do NextAuth ao papel e ao associado)
-- ---------------------------------------------------------------------
create type gov.papel as enum
  ('admin','presidente','vice_presidente','secretario','tesoureiro',
   'conselho_fiscal','coord_patrimonio','coord_eclesiastico','associado');

create table gov.usuario (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  nome           text not null,
  papel          gov.papel not null default 'associado',
  associado_id   uuid unique references gov.associado(id),
  ativo          boolean not null default true,
  ultimo_acesso  timestamptz,
  criado_em      timestamptz not null default now(),
  constraint ck_email_minusculo check (email = lower(email))
);
create unique index ux_usuario_email on gov.usuario (email);

-- Auditoria e RLS no mesmo padrão das demais tabelas sensíveis
create trigger trg_usuario_audit after insert or update or delete on gov.usuario
  for each row execute function gov.fn_auditar();
alter table gov.usuario enable row level security;

-- Primeiro administrador: descomente, troque pelo seu e-mail e rode UMA vez.
-- insert into gov.usuario (email, nome, papel)
-- values (lower('SEU_EMAIL_AQUI'), 'Seu Nome', 'admin');

-- ---------------------------------------------------------------------
-- PERMISSÕES DO SCHEMA gov
-- ---------------------------------------------------------------------
-- Defesa em profundidade: o schema nem é exposto pela API, mas tira o acesso
-- de anon/authenticated de qualquer forma, inclusive para objetos futuros.
revoke all on schema gov from anon, authenticated;
revoke all on all tables in schema gov from anon, authenticated;
revoke all on all sequences in schema gov from anon, authenticated;
revoke all on all functions in schema gov from anon, authenticated;
alter default privileges in schema gov revoke all on tables from anon, authenticated;
alter default privileges in schema gov revoke all on sequences from anon, authenticated;
alter default privileges in schema gov revoke all on functions from anon, authenticated;

-- service_role (usado só no servidor, se o app também falar com a API do Supabase)
grant usage on schema gov to service_role;
grant all on all tables in schema gov to service_role;
grant all on all sequences in schema gov to service_role;
grant execute on all functions in schema gov to service_role;
alter default privileges in schema gov grant all on tables to service_role;
alter default privileges in schema gov grant all on sequences to service_role;
alter default privileges in schema gov grant execute on functions to service_role;

-- ---------------------------------------------------------------------
-- STORAGE: bucket privado para atas, editais, comprovantes e fichas
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('gov-documentos', 'gov-documentos', false)
on conflict (id) do nothing;
-- Sem policies em storage.objects para este bucket: só o servidor (service role)
-- lê e grava, gerando links assinados e temporários quando um usuário precisar abrir um arquivo.
