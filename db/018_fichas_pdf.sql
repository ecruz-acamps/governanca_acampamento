-- 018 · Dados para gerar as fichas de inscrição em PDF (por distribuição/missão)
alter table gov.distribuicao_fichas
  add column if not exists ficha_missao_numero text,
  add column if not exists ficha_saida date,
  add column if not exists ficha_encerramento date,
  add column if not exists ficha_valor numeric(10,2),
  add column if not exists ficha_pix text,
  add column if not exists ficha_contato text,
  add column if not exists ficha_inicio int not null default 1;
alter table gov.distribuicao_fichas drop constraint if exists ck_ficha_dados;
alter table gov.distribuicao_fichas add constraint ck_ficha_dados check (
  (ficha_missao_numero is null or ficha_missao_numero ~ '^[0-9]{1,3}$')
  and (ficha_valor is null or (ficha_valor > 0 and ficha_valor < 100000))
  and ficha_inicio between 1 and 9999
  and (ficha_encerramento is null or ficha_saida is null or ficha_encerramento >= ficha_saida)
);
