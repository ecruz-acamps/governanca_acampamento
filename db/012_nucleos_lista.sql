-- 012 · Lista dos 13 núcleos e separação "dentro/fora da Arquidiocese" (Anitápolis e Garopaba)
alter table gov.nucleo add column if not exists separa_origem boolean not null default false;
alter table gov.distribuicao_pre add column if not exists pre_fora int not null default 0 check (pre_fora >= 0);

insert into gov.nucleo (nome) values
  ('Angelina'),
  ('Santo Amaro da Imperatriz'),
  ('Águas Mornas'),
  ('Palhoça – Paróquia Bom Jesus de Nazaré'),
  ('Palhoça – comunidade (a especificar)'),
  ('Palhoça – Ponte do Imaruim'),
  ('Garopaba'),
  ('São José'),
  ('Biguaçu e Antônio Carlos'),
  ('Florianópolis – Continente / Ilha'),
  ('Leoberto Leal'),
  ('Palhoça – São Sebastião')
on conflict do nothing;

update gov.nucleo set separa_origem = true where lower(nome) in ('anitápolis','garopaba');
