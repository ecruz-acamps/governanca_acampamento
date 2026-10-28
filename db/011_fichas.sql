-- 011 · Divisão de fichas por núcleo
-- Regra: do total de fichas, tira-se o que é fixo (Anitápolis) e a cortesia (Alfredo Wagner);
-- o resto é dividido entre os demais núcleos na proporção das pré-fichas (lista de espera).
-- A reserva (emergência e padres) fica de fora: é somada ao total geral, não entra na divisão.

create table if not exists gov.nucleo (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  tipo          text not null default 'nucleo' check (tipo in ('nucleo','cortesia')),
  fichas_fixas  int check (fichas_fixas is null or fichas_fixas >= 0),  -- se preenchido, não entra na proporção
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);
create unique index if not exists ux_nucleo_nome on gov.nucleo (lower(nome));
-- cortesia sempre tem número fixo
alter table gov.nucleo drop constraint if exists ck_cortesia_fixa;
alter table gov.nucleo add constraint ck_cortesia_fixa check (tipo <> 'cortesia' or fichas_fixas is not null);

create table if not exists gov.distribuicao_fichas (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  ano          int not null check (ano between 2000 and 2100),
  total_fichas int not null check (total_fichas >= 0),          -- fichas divididas entre os núcleos
  reserva_fichas int not null default 0 check (reserva_fichas >= 0), -- fora da divisão: emergência e padres
  criado_em    timestamptz not null default now()
);

create table if not exists gov.distribuicao_pre (
  distribuicao_id uuid not null references gov.distribuicao_fichas(id) on delete cascade,
  nucleo_id       uuid not null references gov.nucleo(id),
  pre_fichas      int not null default 0 check (pre_fichas >= 0),
  primary key (distribuicao_id, nucleo_id)
);

insert into gov.nucleo (nome, tipo, fichas_fixas)
values ('Anitápolis', 'nucleo', 10), ('Alfredo Wagner', 'cortesia', 2)
on conflict do nothing;

do $$ declare t text; begin
  foreach t in array array['nucleo','distribuicao_fichas','distribuicao_pre'] loop
    execute format('alter table gov.%I enable row level security', t);
    if not exists (select 1 from pg_trigger where tgname = 'trg_'||t||'_audit') then
      execute format('create trigger trg_%1$s_audit after insert or update or delete on gov.%1$s
         for each row execute function gov.fn_auditar()', t);
    end if;
  end loop;
end $$;
