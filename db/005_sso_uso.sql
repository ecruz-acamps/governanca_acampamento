-- Links de acesso direto (SSO) são de uso único: cada jti só pode ser usado uma vez.
create table gov.sso_uso (
  jti      text primary key,
  email    text not null,
  usado_em timestamptz not null default now()
);
alter table gov.sso_uso enable row level security;
revoke all on gov.sso_uso from anon, authenticated;
grant all on gov.sso_uso to service_role;
