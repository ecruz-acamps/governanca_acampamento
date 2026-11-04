-- 020 · Configurações do sistema (menu Configurações). Primeira: peso das pré-fichas de fora da Arquidiocese.
create table if not exists gov.configuracao (
  id            text primary key,          -- chave da configuração
  valor         text not null,
  atualizado_em timestamptz not null default now()
);
alter table gov.configuracao enable row level security;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_configuracao_audit') then
    create trigger trg_configuracao_audit after insert or update or delete on gov.configuracao
      for each row execute function gov.fn_auditar();
  end if;
end $$;
-- parte do peso já definido na distribuição mais recente (ou 0,5)
insert into gov.configuracao (id, valor)
select 'peso_fora', coalesce((select peso_fora::text from gov.distribuicao_fichas order by criado_em desc limit 1), '0.5')
on conflict (id) do nothing;
