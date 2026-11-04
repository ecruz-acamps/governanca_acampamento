-- 019 · Peso das pré-fichas de fora da Arquidiocese na divisão das fichas (0 a 1; 0,5 = vale metade)
alter table gov.distribuicao_fichas add column if not exists peso_fora numeric(4,2) not null default 0.50;
alter table gov.distribuicao_fichas drop constraint if exists ck_peso_fora;
alter table gov.distribuicao_fichas add constraint ck_peso_fora check (peso_fora >= 0 and peso_fora <= 1);
