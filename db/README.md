# Banco de dados

Projeto Supabase `governanca-spp` (ref `dftjwjnctawugdadnqlq`, região sa-east-1). Aplique as migrações em ordem
numérica e **antes** de publicar o código que depende delas. Nunca coloque a senha do banco em conversa ou arquivo.

| Migração | O que faz |
|---|---|
| 001 | Base: associados, assembleias, mandatos, financeiro, patrimônio etc., com auditoria (sem `senha_hash`) e RLS |
| 002 | Usuários, papéis e log de acessos |
| 003 | Geração de obrigações do calendário |
| 004 | Senha própria (hash Argon2id) |
| 005 | Uso único do token de SSO |
| 006 | Eleições: candidaturas, voto secreto e apuração |
| 007 | Recuperação de senha (`gov.reset_senha`, token só como hash) |
| 008 | Conselho Geral e missões (Art. 25 e 26): uma designação aberta por associado, coordenador aprovado antes de a missão iniciar |
| 009 | Superadmin (único que apaga usuários) e a função `gov.resetar_sistema` |
| 010 | Coordenador e auxiliares de missão que não são associados (nome livre) |
| 011 | Divisão de fichas por núcleo: núcleos, distribuições, pré-fichas e reserva |
| 012 | Os núcleos (Palhoça por paróquia) e a separação dentro/fora da Arquidiocese |
| 013 | Distribuição de fichas ligada a uma missão |
| 014 | Núcleo Santa Rosa / Armazém |
| 015 | Área de patrimônio do usuário (só a da secretaria acessa as fichas) |

Ao recriar do zero use 001, depois 002 e 004, e troque `fn_auditar` para remover `senha_hash` do JSON auditado.
