# Governança — Assoc. dos Campistas São Padre Pio (Fase 1)

Associados, reuniões/presença, mandatos, calendário de obrigações, usuários e auditoria.
Next.js 14 + Supabase (Postgres, esquema `gov`). Login próprio (senha só como hash Argon2id).

## 1. Rodar localmente
1. `npm install`
2. Copie `.env.example` para `.env.local` e preencha:
   - `DATABASE_URL`: Supabase > Project Settings > Database > Transaction pooler (porta 6543), com a senha do banco.
   - `NEXTAUTH_SECRET`: `openssl rand -base64 32`
3. Defina a senha do administrador (não passa pela internet):
   `npm run definir-senha -- petiago@acampamento.com.br`
4. `npm run dev` e abra http://localhost:3000

## 2. Publicar na Vercel
1. Suba esta pasta para um repositório no GitHub e importe na Vercel (framework: Next.js).
2. Em Settings > Environment Variables, cadastre `DATABASE_URL`, `NEXTAUTH_SECRET` e `NEXTAUTH_URL` (a URL final do site).
3. Deploy. O banco já está pronto (pasta `db/`).

## Segurança
- Só o servidor acessa o banco; `anon`/`authenticated` não têm acesso.
- Bloqueio de 15 min após 5 erros de senha; histórico em Auditoria > Últimos acessos.
- Papéis em `src/lib/perms.ts`.
