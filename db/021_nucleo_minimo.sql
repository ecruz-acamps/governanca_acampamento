-- 021 · Fichas mínimas por núcleo: entra na divisão proporcional, mas nunca recebe menos que o mínimo
alter table gov.nucleo add column if not exists fichas_minimas int;
alter table gov.nucleo drop constraint if exists ck_fichas_minimas;
alter table gov.nucleo add constraint ck_fichas_minimas check (fichas_minimas is null or fichas_minimas >= 0);
-- Anitápolis: deixa de ser fixo (10) e passa a ter no mínimo 10
update gov.nucleo set fichas_minimas = 10, fichas_fixas = null
 where tipo = 'nucleo' and lower(nome) in ('anitápolis', 'anitapolis');
