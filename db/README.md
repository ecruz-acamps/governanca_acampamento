# Banco de dados

Projeto Supabase `governanca-spp` (ref `dftjwjnctawugdadnqlq`, região sa-east-1).
Aplicado em duas migrações equivalentes a: 001 (base + auditoria sem senha_hash) e 002+004 (usuários com senha,
log de acessos, auditoria seletiva de usuários, bucket privado). Os arquivos 001–004 desta pasta são o registro;
ao recriar do zero use 001, depois 002 e 004, e troque `fn_auditar` para remover `senha_hash` do JSON auditado.

Migrações seguintes: 003 (geração de obrigações), 005 (uso único do token de SSO) e 006 (eleições: validação de
candidaturas, voto secreto e apuração). Aplique em ordem numérica.

A migração 007 cria `gov.reset_senha` (tokens de recuperação de senha, guardados só como hash).

A migração 008 cria as regras do Conselho Geral e das missões (Art. 25 e 26): uma designação aberta por associado, coordenador aprovado antes de a missão iniciar, equipe só de associados ativos, e auditoria.

A migração 009 cria o superadmin (único que apaga usuários e reinicia o sistema) e a função `gov.resetar_sistema`. Aplique a 009 ANTES de publicar o código que a usa.

A migração 010 permite coordenador e auxiliares de missão que não são associados (nome livre). Aplique a 010 ANTES de publicar o código que a usa.

A migração 011 cria a divisão de fichas por núcleo (núcleos, distribuições e pré-fichas). Aplique a 010 e a 011 ANTES de publicar o código.
