# Banco de dados

Aplicados no projeto Supabase `governanca-spp`, nesta ordem: 001, 002, 003, 004.
O banco já está pronto; estes arquivos servem de registro e para recriar o ambiente.
Obs.: a 004 usa `create or replace function gov.fn_auditar()` removendo `senha_hash` do JSON auditado
(já aplicado no projeto). Ao recriar do zero, aplique essa troca depois da 001.
