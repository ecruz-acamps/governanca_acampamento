# Governança — Associação dos Campistas São Padre Pio

Sistema web que faz a associação **cumprir o próprio estatuto** sem depender de memória, planilha ou caderno. O que o estatuto exige (prazos, quórum, votações, prestação de contas, mandatos) vira regra do sistema, e o sistema avisa quando algo está vencendo ou fora do que o estatuto permite.

> Base normativa: Estatuto Social, Segundo Instrumento de Alteração (26/08/2023). O estatuto **não foi alterado**: o sistema se adapta a ele, não o contrário.

---

## 1. A dor que este sistema resolve

Uma associação de voluntários é tocada por pessoas com pouco tempo, que mudam a cada mandato. O estatuto tem dezenas de regras que são fáceis de esquecer e caras de errar:

| Dor do dia a dia | O que o estatuto diz | Como era | Como fica |
|---|---|---|---|
| "Quem é associado de verdade hoje?" | Art. 6 e 7: requisitos de admissão, saída, suspensão | Lista em planilha ou na cabeça de alguém | Cadastro com o ciclo completo: interessado, em acompanhamento, associado, suspenso, desligado |
| "Essa assembleia vale?" | Art. 13 II (convocação com 30 dias), quórum por convocação | Descobre-se o erro depois, na ata | O banco **recusa** convocar com menos de 30 dias e calcula quórum e maioria sozinho |
| "Quem faltou demais?" | Mínimo de 75% de presença | Contagem manual no fim do ano | Presença registrada por reunião, percentual automático e alerta no Painel |
| "Pode aplicar essa penalidade?" | Art. 8: consenso prévio, recurso em 5 dias, assembleia em 30 dias | Processo informal, sem prazo controlado | Processo com etapas e prazos que o banco impõe |
| "Quando acaba o mandato da Diretoria?" | Art. 16 e 21: 3 anos, Conselho Fiscal 3+3 | Descobre-se quando já venceu | Mandatos com contagem regressiva e alertas |
| "A eleição está no prazo?" | Art. 28 a 30: até 30/11, candidatos, voto secreto | Cédula de papel, apuração manual | Eleição com prazos, voto secreto e apuração automática |
| "Esse gasto foi autorizado? Tem comprovante?" | Art. 20: toda despesa autorizada e comprovada | Comprovantes soltos | Despesa sem autorização **não entra**; sem comprovante aparece em destaque |
| "Podemos aceitar essa doação ou convênio?" | Art. 5: três aprovações | Decisão verbal | Aceite só com Conselho, orientação espiritual e coordenação geral |
| "Esse bem pode ser vendido?" | Art. 5, parágrafo único, Art. 12 I, Art. 22 d | Sem controle do patrimônio | Inventário; baixa só com assembleia e parecer do Conselho Fiscal |
| "O que foi alterado, por quem?" | Transparência e prestação de contas | Ninguém sabe | Auditoria de cada alteração, com autor e data |

Em resumo: **a dor era depender de lembrar das regras do estatuto na hora certa.** O sistema lembra por você e, nos pontos mais críticos, impede o erro.

---

## 2. Por que foi feito assim

**Regra no banco, não só na tela.** As regras do estatuto estão como restrições e gatilhos no Postgres (esquema `gov`). Assim, mesmo que alguém altere uma tela ou chame o sistema por outro caminho, o banco recusa o que o estatuto proíbe. Cada regra tem uma mensagem em português que explica o motivo.

**Voto secreto de verdade.** A urna guarda só "concordo" ou "discordo" por candidato, sem identificar o eleitor. A lista de quem já votou fica em outra tabela, só com a data (sem hora), e os votos entram em ordem aleatória. Não há como ligar o voto à pessoa, nem para o administrador. A urna também fica fora da auditoria de propósito.

**Simples de operar, por voluntários.** Uma pessoa sem conhecimento técnico precisa conseguir usar. Por isso: telas diretas, mensagens de erro em português claro, funciona no celular e pode ser instalado como aplicativo.

**Segurança proporcional ao dado.** O sistema guarda dados pessoais de associados e processos disciplinares.
- Senhas guardadas apenas como hash **Argon2id**; nunca em texto.
- Bloqueio de 15 minutos após 5 erros de senha, com histórico de tentativas.
- Só o servidor acessa o banco; o acesso público direto ao banco é desativado.
- Papéis com permissões mínimas (veja a seção 6).
- O aplicativo instalável **não guarda dados em cache** no celular.

**Barato e fácil de manter.** Next.js na Vercel e Postgres no Supabase, sem servidor próprio para administrar.

**Separado de outros sistemas.** Tem projeto próprio no Supabase, isolado dos demais. Um link de acesso direto (SSO assinado) permite entrar a partir de outro sistema interno, sem duplicar senha.

---

## 3. O que o sistema faz

**Equipe (Diretoria e Conselho)**
- **Painel:** alertas de prazos, mandatos a vencer, associados abaixo de 75% e obrigações pendentes.
- **Associados:** cadastro e ciclo de vida (admissão, acompanhamento, suspensão, desligamento), inclusive admissão proposta por outro associado (exige assembleia).
- **Reuniões e presença:** lista de presença por reunião.
- **Assembleias:** convocação, presença, quórum, deliberações e maioria.
- **Disciplinar:** processo com consenso, medida, recurso e assembleia nos prazos do Art. 8.
- **Eleições:** candidaturas, voto secreto, apuração, nova rodada e posse.
- **Conselho Geral e missões (Art. 25 e 26):** membros designados pelo Orientador Espiritual; coordenador de missão só inicia depois de aprovado pelo Conselho Geral; coordenadores, pregadores e auxiliares podem ser associados ou pessoas de fora (nome e contato).
- **Fichas por núcleo:** divide as fichas do acampamento entre os 14 núcleos pelas pré-fichas (lista de espera) de cada um. O total é definido por missão e pode mudar a qualquer momento: Anitápolis (10 fixas, acordo com a prefeitura) e Alfredo Wagner (2 de cortesia, não é núcleo) saem antes da divisão, e o aumento do total vai só para os demais núcleos. A reserva (8 fichas de emergência e padres) fica fora da conta. Anitápolis e Garopaba registram pré-fichas de dentro e de fora da Arquidiocese.
- **Documentos em PDF:** edital de convocação, ata de assembleia, lista de presença (reunião e assembleia) e balancete/prestação de contas, com assinaturas do Presidente, Secretário, Tesoureiro e Conselho Fiscal.
- **Mandatos:** Diretoria e Conselho Fiscal, com ciclo de 3 anos.
- **Financeiro, convênios e doações, prestação de contas:** lançamentos autorizados e comprovados, aceite com três aprovações, parecer do Conselho Fiscal e aprovação em assembleia.
- **Patrimônio:** inventário e baixa de bens. Cada coordenador de patrimônio tem uma área (ex.: secretaria), porque haverá vários patrimônios.
- **Calendário de obrigações, usuários e auditoria.**
- **API (só superadmin):** busca as pré-fichas de cada núcleo no banco de outro sistema, por uma API protegida por token, para não precisar perguntar a cada núcleo. Mostra uma prévia (hoje x API) antes de gravar e guarda o histórico. Contrato em `docs/api-pre-fichas.md`.
- **Superadmin:** conta única que apaga usuários e tem o botão *Reiniciar o sistema*, que apaga todos os dados e mantém só a própria conta (pede a frase `APAGAR TUDO` e a senha). Só ele altera a própria conta.

**Associado (portal)**
- Situação e presença dele, próximas reuniões e assembleias.
- Carteirinha digital com QR code, conferível por uma página pública.
- Voto secreto pelo celular.
- Histórico das próprias presenças.

---

## 4. Como foi construído

- **Aplicativo:** Next.js 14 (App Router, ações de servidor) e TypeScript.
- **Login:** NextAuth (credenciais, sessão JWT de 8 h) e SSO por token assinado de uso único.
- **Banco:** Supabase Postgres, esquema `gov`, acessado só pelo servidor via pooler em modo transação (`postgres.js`).
- **Senhas:** `@node-rs/argon2` (Argon2id).
- **Auditoria:** gatilho no banco que registra quem alterou o quê e quando, sem gravar senhas.
- **Aplicativo instalável (PWA):** manifesto, ícones, página offline e service worker que não guarda dados privados.
- **Hospedagem:** Vercel, com as funções em São Paulo (`gru1`), perto do banco.

Fases de entrega:
1. **Base:** associados, reuniões e presença, mandatos, calendário, usuários e auditoria.
2. **Assembleias e disciplina**, depois **eleições**.
3. **Finanças e patrimônio.**
4. **Portal do associado, carteirinha com QR e PWA.**

### Estrutura do repositório
```
src/app/(app)/   telas autenticadas (equipe e portal)
src/app/login, sso, verificar   telas de acesso e conferência pública
src/lib/         banco, autenticação, permissões, regras de formulário
db/              migrações SQL (o registro do banco)
docs/sso.md      acesso direto a partir de outro sistema
scripts/         definir senha e gerar link de SSO
public/          ícones, service worker e página offline
```

---

## 5. Como usar no dia a dia

**Primeiro acesso.** O administrador cria cada usuário em *Usuários*, com uma senha temporária. A pessoa entra, o sistema pede para trocar a senha, e pronto. Para o associado, crie o usuário com papel **Associado** e ligue ao cadastro dele.

**Rotina mensal**
1. **Antes da reunião:** crie a reunião em *Reuniões e presença* (tipo, data, pauta).
2. **Na reunião:** abra a reunião, marque quem veio e justifique as ausências. Clique em *Salvar presenças*.
3. **Olhe o Painel:** confira alertas de prazos, mandatos a vencer e quem está abaixo de 75%.
4. **Financeiro:** registre cada receita e despesa do mês, informando quem autorizou a despesa e a referência do comprovante.

**Admitir um associado.** Em *Associados*, cadastre a pessoa e acompanhe o processo até a admissão. Preencha os requisitos do Art. 6. Se a admissão foi proposta por outro associado, registre a deliberação da assembleia e ligue-a ao cadastro.

**Fazer uma assembleia**
1. *Assembleias*: convoque com **pelo menos 30 dias** de antecedência (o sistema recusa menos que isso).
2. No dia, registre a presença (presencial ou remota). O sistema calcula o quórum da convocação.
3. Registre as deliberações e os votos. O sistema aplica a maioria exigida para cada matéria.

**Fazer uma eleição**
1. *Eleições* > criar, com data **até 30/11**.
2. Abra as candidaturas e registre os candidatos (Diretoria exige missão do sênior; prazos do Art. 29).
3. Abra a votação. Cada associado vota uma vez, em sigilo, pelo portal ou pela tela da eleição.
4. Encerre e apure. Quem perder é rejeitado e abre-se nova rodada para o cargo.
5. Empossar os eleitos cria o ciclo de 3 anos e os mandatos.

**Prestar contas**
1. *Prestação de contas* > criar (mensal, trimestral de verba pública ou balancete anual) e emitir.
2. O Conselho Fiscal registra o parecer.
3. Leve à assembleia e marque como aprovada. O balancete anual exige deliberação aprovada de "Contas anuais".

**Dividir as fichas do acampamento**
1. *Conselho Geral e missões*: crie a missão (ex.: 12º Acampamento). Coordenador, pregadores e auxiliares podem ser pessoas de fora; o coordenador precisa da aprovação do Conselho Geral para a missão iniciar.
2. *Fichas por núcleo* > *Nova distribuição*: escolha a missão e informe as fichas para os núcleos e a reserva.
3. Preencha as **pré-fichas** de cada núcleo conforme eles responderem e clique em *Salvar e recalcular*. A tela mostra a porcentagem e as fichas de cada núcleo, e a soma fecha no total.
4. Se o total mudar, altere o número e recalcule: só os núcleos proporcionais ganham ou perdem fichas.

**Gerar documentos em PDF.** Na assembleia: edital, lista de presença e ata (depois de instalada). Na reunião: lista de presença. Na prestação de contas: *Baixar PDF*. Horário e local da assembleia saem em branco para preencher à mão.

**Aceitar doação ou convênio.** Registre em *Convênios e doações* e colete as três aprovações. Só depois dá para aceitar e usar o convênio em lançamentos de verba pública.

**Patrimônio.** Cadastre os bens no inventário. Para dar baixa, é preciso uma deliberação aprovada de alienação e a data do parecer do Conselho Fiscal.

**Associado no celular.** Instale como aplicativo (Android: menu do Chrome > *Instalar aplicativo*; iPhone: Safari > Compartilhar > *Adicionar à Tela de Início*). No portal ele vê a presença, a carteirinha com QR e vota quando houver eleição aberta.

---

## 6. Quem pode fazer o quê

| Papel | Pode |
|---|---|
| Superadmin | Tudo, e é o único que apaga usuários e reinicia o sistema |
| Administrador | Quase tudo, inclusive usuários (sem apagar) e auditoria |
| Presidente, vice-presidente | Operar assembleias, eleições, disciplina, finanças e patrimônio conforme o caso |
| Secretário | Associados, reuniões, assembleias, mandatos, eleições, calendário |
| Tesoureiro | Financeiro, convênios, prestação de contas e fichas |
| Conselho Fiscal | Consulta financeira e parecer das prestações |
| Coord. de patrimônio | Patrimônio; e as fichas, só se for o da área **secretaria** |
| Coord. eclesiástico | Associados e disciplinar |
| Associado | Só o próprio portal |

**Fichas por núcleo:** acessam e editam presidente, secretário, tesoureiro, coordenador do patrimônio da secretaria e superadmin. Os demais papéis não veem a tela.

As permissões completas estão em `src/lib/perms.ts`.

---

## 7. Instalar e publicar

### Rodar localmente
1. `npm install`
2. Copie `.env.example` para `.env.local` e preencha:
   - `DATABASE_URL`: Supabase > Project Settings > Database > Transaction pooler (porta 6543).
   - `NEXTAUTH_SECRET`: `openssl rand -base64 32`
3. Defina a senha do administrador: `npm run definir-senha -- seu-email@exemplo.com`, ou, sem terminal, pela tela `/primeiro-acesso` com o código `SETUP_TOKEN`.
4. `npm run dev` e abra http://localhost:3000

### Publicar na Vercel
1. Importe o repositório na Vercel (framework: Next.js).
2. Em *Settings > Environment Variables*, cadastre `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` e, se for usar, `SETUP_TOKEN` (apague depois) e `SSO_SECRET`.
3. Para a recuperação de senha por e-mail, cadastre também as variáveis de SMTP ou do Resend (veja a seção *Recuperação de senha* abaixo).
4. Deploy. O `vercel.json` já manda as funções para São Paulo.

### Recuperação de senha por e-mail
Na tela de login, *Esqueci minha senha* pede o e-mail e envia um link para criar uma nova senha. O link vale por 30 minutos e só pode ser usado uma vez; o banco guarda apenas o hash do token. A resposta é sempre a mesma, exista o e-mail ou não, e há limite de 3 pedidos por hora por conta. Quem abre o link prova que controla o e-mail.

Para funcionar, escolha **uma** das opções e cadastre as variáveis na Vercel:
- **SMTP do e-mail profissional** (não precisa de serviço extra): `SMTP_HOST`, `SMTP_PORT` (465 ou 587), `SMTP_USER`, `SMTP_PASS` e, opcionalmente, `EMAIL_FROM`.
- **Resend** ([resend.com](https://resend.com)): `RESEND_API_KEY` e `EMAIL_FROM`, com o domínio de envio verificado.

Sem isso, a tela avisa que o envio não está configurado e a senha continua sendo redefinida pelo administrador em *Usuários*. Opcional: `APP_URL` com o endereço público do sistema.

### Banco de dados
As migrações (001 a 015) estão em `db/` (veja `db/README.md`) e devem ser aplicadas em ordem numérica, **antes** de publicar o código que depende delas. Nunca coloque a senha do banco em conversa ou em arquivo do repositório: ela só vai nas variáveis de ambiente da Vercel.

### API de pré-fichas
Cadastre `PREFICHAS_API_URL` e `PREFICHAS_API_TOKEN` na Vercel (veja `docs/api-pre-fichas.md`). A aba *API* é visível só ao superadmin.

### Acesso direto de outro sistema (SSO)
Veja `docs/sso.md`. Requer `SSO_SECRET` (mínimo 32 caracteres) na Vercel e no sistema interno.

---

## 8. Limites conhecidos e próximos passos (v1.1)

- **Avisos automáticos** por e-mail e WhatsApp (convocações, prazos, alertas).
- **Envio real de comprovantes e documentos** ao Supabase Storage. Hoje o comprovante é só uma referência em texto.
- **Notificações no celular** (push).
- **Chamada por QR:** registrar presença lendo a carteirinha na entrada.
- Revisão jurídica: o sistema aplica o estatuto como foi lido pela equipe. Em caso de dúvida de interpretação, vale a decisão da assembleia e de quem a associação consulta juridicamente.

Este sistema apoia a gestão, mas **não substitui a assessoria jurídica e contábil** da associação.
