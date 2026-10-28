-- 012 · Lista dos 13 núcleos e separação "dentro/fora da Arquidiocese" (Anitápolis e Garopaba)
alter table gov.nucleo add column if not exists separa_origem boolean not null default false;
alter table gov.distribuicao_pre add column if not exists pre_fora int not null default 0 check (pre_fora >= 0);

-- nomes provisórios de uma versão anterior da lista (só sai quem ainda não tem pré-fichas lançadas)
delete from gov.nucleo n
 where n.nome in ('Palhoça – Paróquia Bom Jesus de Nazaré','Palhoça – comunidade (a especificar)','Palhoça – Ponte do Imaruim')
   and not exists (select 1 from gov.distribuicao_pre p where p.nucleo_id = n.id);

insert into gov.nucleo (nome) values
  ('Angelina'),
  ('Santo Amaro da Imperatriz'),
  ('Águas Mornas'),
  ('Palhoça – São Judas Tadeu e São João Batista'),
  ('Palhoça – São Sebastião'),
  ('Palhoça – São Francisco de Assis'),
  ('Palhoça – Bom Jesus de Nazaré'),
  ('Garopaba'),
  ('São José'),
  ('Biguaçu e Antônio Carlos'),
  ('Florianópolis – Continente / Ilha'),
  ('Leoberto Leal')
on conflict do nothing;

update gov.nucleo set separa_origem = true where lower(nome) in ('anitápolis','garopaba');
