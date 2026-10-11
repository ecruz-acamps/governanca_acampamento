-- =====================================================================
-- Módulo de GOVERNANÇA — Associação dos Campistas São Padre Pio
-- Base normativa: Estatuto Social (2º instrumento de alteração, 26/08/2023)
-- Alvo: PostgreSQL 15+ (Supabase). Schema próprio "gov" para não colidir
-- com as tabelas do AcampsGestão.
--
-- Acesso: via servidor (Next.js + NextAuth RBAC) com service role.
-- RLS fica habilitada sem policies (nega anon/authenticated por padrão).
-- =====================================================================

create extension if not exists pgcrypto;
create schema if not exists gov;

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
create type gov.status_associado as enum
  ('interessado','em_acompanhamento','associado','suspenso','excluido','desligado');

create type gov.tipo_acampamento as enum
  ('senior','juvenil','fac','casais','mirim','outro');

create type gov.tipo_reuniao as enum
  ('mensal','diretoria','conselho_geral','cpp','missa_campistas','outra');

-- Diretoria (Art. 16) + Conselho Fiscal (Art. 21)
create type gov.cargo as enum
  ('presidente','vice_presidente','secretario','segundo_secretario',
   'tesoureiro','segundo_tesoureiro','coord_patrimonio_1','coord_patrimonio_2',
   'coord_eclesiastico','fiscal_titular','fiscal_suplente');

create type gov.tipo_assembleia as enum ('AGO','AGE');

create type gov.materia as enum
  ('contas_anuais','eleicao_posse','proposta_atividades','alienacao_bem',
   'recurso_disciplinar','alteracao_estatuto','destituicao_administrador',
   'admissao_associado','exclusao_associado','aceite_doacao_convenio','outra');

create type gov.medida_disciplinar as enum ('advertencia','suspensao','exclusao');

create type gov.motivo_disciplinar as enum
  ('dano_moral_material',            -- Art. 8 §1 a
   'faltas_reunioes',                -- Art. 8 §1 b
   'uso_indevido_associacao',        -- Art. 8 §1 c
   'ato_incompativel_objetivos',     -- Art. 8 §1 d
   'descumprimento_estatuto',        -- Art. 7 §1 e Art. 8
   'discordia_ou_quebra_de_sigilo',  -- Art. 24 d
   'outro');

create type gov.origem_recurso as enum ('propria','doacao','verba_publica','convenio');

-- ---------------------------------------------------------------------
-- DOCUMENTOS (livro de atas, editais, comprovantes)
-- ---------------------------------------------------------------------
create table gov.documento (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in
                 ('ata_assembleia','ata_reuniao','edital','relatorio','prestacao_contas',
                  'ficha_inscricao','carta_promessa','comprovante','outro')),
  titulo        text not null,
  storage_path  text not null,
  sha256        text,
  enviado_por   text,
  criado_em     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ASSOCIADOS (Cap. III — Art. 6 a 8)
-- ---------------------------------------------------------------------
create table gov.associado (
  id                        uuid primary key default gen_random_uuid(),
  pessoa_id                 uuid,                      -- vínculo opcional com o cadastro de campistas existente
  nome                      text not null,
  email                     text,
  telefone                  text,
  data_nascimento           date,
  status                    gov.status_associado not null default 'interessado',
  -- requisitos de admissão (Art. 6 §1 e §2)
  acampamento_tipo          gov.tipo_acampamento,
  acampamento_ano           int,
  primeira_eucaristia       boolean not null default false,
  participou_missao_senior  boolean not null default false,   -- condição p/ Diretoria (Art. 16 §1)
  motivo_pedido             text,                      -- "escrevendo o motivo desta vontade" (Art. 6 §1 b)
  ficha_documento_id        uuid references gov.documento(id),
  proposto_por              uuid references gov.associado(id), -- Art. 7 n
  data_pedido               date,
  data_admissao             date,
  data_promessa             date,                      -- Art. 6 §3
  carta_promessa_documento_id uuid references gov.documento(id),
  data_saida                date,                      -- Art. 7 q: pode sair a qualquer tempo
  motivo_saida              text,
  observacoes               text,
  criado_em                 timestamptz not null default now(),
  atualizado_em             timestamptz not null default now(),
  constraint ck_requisitos_associado check (
    status <> 'associado' or
    (acampamento_tipo is not null and primeira_eucaristia and data_admissao is not null)
  )
);
create index on gov.associado (status);

-- ---------------------------------------------------------------------
-- REUNIÕES E PRESENÇA (Art. 7 j — 75% de presença; Art. 24)
-- ---------------------------------------------------------------------
create table gov.reuniao (
  id               uuid primary key default gen_random_uuid(),
  tipo             gov.tipo_reuniao not null,
  data             date not null,
  titulo           text,
  local            text,
  pauta            text,
  ata_documento_id uuid references gov.documento(id),
  conta_presenca   boolean not null default true,   -- entra no cálculo dos 75%
  criado_em        timestamptz not null default now()
);
create index on gov.reuniao (data);

create table gov.presenca (
  reuniao_id    uuid not null references gov.reuniao(id) on delete cascade,
  associado_id  uuid not null references gov.associado(id),
  presente      boolean not null default true,
  justificativa text,
  primary key (reuniao_id, associado_id)
);

create view gov.v_frequencia_anual as
select a.id as associado_id,
       a.nome,
       extract(year from r.data)::int as ano,
       count(*)                                  as reunioes_no_periodo,
       count(*) filter (where p.presente)        as presencas,
       round(100.0 * count(*) filter (where p.presente) / count(*), 1) as percentual,
       (100.0 * count(*) filter (where p.presente) / count(*)) < 75    as abaixo_do_minimo
from gov.associado a
join gov.reuniao r
  on r.conta_presenca
 and a.data_admissao is not null
 and r.data >= a.data_admissao
 and (a.data_saida is null or r.data <= a.data_saida)
left join gov.presenca p
  on p.reuniao_id = r.id and p.associado_id = a.id
where a.status in ('associado','suspenso')
group by a.id, a.nome, extract(year from r.data);

-- ---------------------------------------------------------------------
-- ASSEMBLEIAS (Seção I — Art. 10 a 15)
-- ---------------------------------------------------------------------
create table gov.assembleia (
  id                   uuid primary key default gen_random_uuid(),
  tipo                 gov.tipo_assembleia not null,
  titulo               text not null,
  convocada_por        text not null check (convocada_por in
                        ('presidente','diretoria','conselho_geral','um_quinto_associados')),
  data_convocacao      date not null,
  data_realizacao      date not null,
  canais_divulgacao    text[],                       -- reuniões mensais, convites, missas (Art. 13 II)
  edital_documento_id  uuid references gov.documento(id),
  convocacao_numero    int not null default 1 check (convocacao_numero between 1 and 3),
  associados_aptos     int,                          -- snapshot na data da convocação
  presentes            int,
  status               text not null default 'convocada' check (status in
                        ('convocada','instalada','realizada','sem_quorum','cancelada')),
  voto_qualidade_usado boolean not null default false,   -- Art. 15
  ata_documento_id     uuid references gov.documento(id),
  criado_em            timestamptz not null default now(),
  -- Art. 13 II: convocação com 30 dias de antecedência
  constraint ck_antecedencia_30d check (data_realizacao >= data_convocacao + 30)
);

create table gov.assembleia_presenca (
  assembleia_id uuid not null references gov.assembleia(id) on delete cascade,
  associado_id  uuid not null references gov.associado(id),
  modalidade    text not null default 'presencial' check (modalidade in ('presencial','remota')),
  primary key (assembleia_id, associado_id)
);

-- Quórum de instalação (Art. 11 par. único e Art. 13 I).
-- Interpretação adotada: AGO 1ª conv. = metade+1; 2ª conv. = qualquer número.
-- AGE 1ª = maioria absoluta; 2ª = 1/3; 3ª = mínimo de 10%.
create function gov.quorum_instalacao(
  p_tipo gov.tipo_assembleia, p_conv int, p_aptos int, p_presentes int)
returns boolean language sql immutable as $$
  select case
    when p_tipo = 'AGO' and p_conv = 1 then p_presentes >= (p_aptos / 2) + 1
    when p_tipo = 'AGO'                then true
    when p_conv = 1                    then p_presentes * 2 > p_aptos
    when p_conv = 2                    then p_presentes * 3 >= p_aptos
    else                                    p_presentes * 10 >= p_aptos
  end
$$;

-- ---------------------------------------------------------------------
-- DELIBERAÇÕES
-- ---------------------------------------------------------------------
create table gov.deliberacao (
  id              uuid primary key default gen_random_uuid(),
  assembleia_id   uuid not null references gov.assembleia(id) on delete cascade,
  materia         gov.materia not null,
  descricao       text not null,
  votos_favor     int not null default 0,
  votos_contra    int not null default 0,
  abstencoes      int not null default 0,
  voto_qualidade  boolean not null default false,
  resultado       text check (resultado in ('aprovada','rejeitada','adiada')),
  criado_em       timestamptz not null default now()
);

-- Maioria exigida por matéria:
--  alteração de estatuto / destituição: 50% + 1 dos presentes (Art. 12 III e V)
--  exclusão de associado: maioria absoluta dos membros (Art. 8)
--  demais: mais votos favoráveis que contrários
create function gov.maioria_ok(
  p_materia gov.materia, p_favor int, p_contra int, p_presentes int, p_aptos int)
returns boolean language sql immutable as $$
  select case
    when p_materia in ('alteracao_estatuto','destituicao_administrador') then p_favor * 2 > p_presentes
    when p_materia = 'exclusao_associado'                                then p_favor * 2 > p_aptos
    else p_favor > p_contra
  end
$$;

-- admissão proposta por outro associado precisa ser aprovada em assembleia (Art. 7 n)
alter table gov.associado
  add column admissao_deliberacao_id uuid references gov.deliberacao(id),
  add constraint ck_admissao_proposta check (
    status <> 'associado' or proposto_por is null or admissao_deliberacao_id is not null
  );

-- ---------------------------------------------------------------------
-- PROCESSO DISCIPLINAR (Art. 7 §§, Art. 8)
-- ---------------------------------------------------------------------
create table gov.processo_disciplinar (
  id                         uuid primary key default gen_random_uuid(),
  associado_id               uuid not null references gov.associado(id),
  medida                     gov.medida_disciplinar not null,
  motivo                     gov.motivo_disciplinar not null,
  descricao                  text not null,
  aberto_em                  date not null default current_date,
  -- Art. 8 §1: coordenação geral em consenso com conselho e orientador espiritual
  consenso_registrado        boolean not null default false,
  defesa_apresentada_em      date,
  defesa_texto               text,
  aplicada_em                date,
  ciencia_pessoal_em         date,
  prazo_recurso              date generated always as (ciencia_pessoal_em + 5) stored,   -- Art. 8 §2
  recurso_em                 date,
  recurso_texto              text,
  recurso_protocolado_secretaria_paroquial boolean not null default false,
  prazo_assembleia           date generated always as (recurso_em + 30) stored,          -- Art. 8 §2
  assembleia_id              uuid references gov.assembleia(id),
  resultado                  text check (resultado in ('mantida','revogada','convertida')),
  status                     text not null default 'aberto' check (status in
                              ('aberto','aplicada','em_recurso','encerrada')),
  criado_em                  timestamptz not null default now(),
  constraint ck_recurso_no_prazo check (
    recurso_em is null or ciencia_pessoal_em is null or recurso_em <= ciencia_pessoal_em + 5
  ),
  constraint ck_aplicacao_exige_consenso check (aplicada_em is null or consenso_registrado)
);
-- O recurso NÃO tem efeito suspensivo (Art. 8 §2): o status do associado muda na aplicação.

-- ---------------------------------------------------------------------
-- MANDATOS: Diretoria e Conselho Fiscal (Art. 16 e 21)
-- ---------------------------------------------------------------------
create table gov.ciclo_mandato (
  id      uuid primary key default gen_random_uuid(),
  inicio  date not null,
  fim     date not null,           -- 3 anos (Art. 16 §2 e Art. 21 §2)
  criado_em timestamptz not null default now(),
  check (fim > inicio)
);

create table gov.mandato (
  id                  uuid primary key default gen_random_uuid(),
  ciclo_id            uuid not null references gov.ciclo_mandato(id),
  associado_id        uuid not null references gov.associado(id),
  cargo               gov.cargo not null,
  inicio              date not null,
  fim                 date not null,
  situacao            text not null default 'ativo' check (situacao in
                       ('ativo','encerrado','afastado')),   -- afastado: Art. 35 (candidatura política)
  substitui_id        uuid references gov.mandato(id),      -- vacância: Art. 16 §3
  motivo_encerramento text,
  criado_em           timestamptz not null default now(),
  check (fim > inicio)
);
-- um único ocupante ativo por cargo da Diretoria em cada ciclo
create unique index ux_mandato_cargo_unico on gov.mandato (ciclo_id, cargo)
  where situacao = 'ativo' and cargo not in ('fiscal_titular','fiscal_suplente');

create function gov.fn_valida_mandato() returns trigger language plpgsql as $$
declare
  v_assoc gov.associado%rowtype;
  v_n int;
begin
  select * into v_assoc from gov.associado where id = new.associado_id;
  if v_assoc.status <> 'associado' then
    raise exception 'Mandato exige associado ativo (% esta com status %)', v_assoc.nome, v_assoc.status;
  end if;
  if new.cargo not in ('fiscal_titular','fiscal_suplente') and not v_assoc.participou_missao_senior then
    raise exception 'Art. 16 par. 1: para a Diretoria e obrigatorio ter participado da missao do senior (%)', v_assoc.nome;
  end if;
  if new.situacao = 'ativo' and new.cargo in ('fiscal_titular','fiscal_suplente') then
    select count(*) into v_n from gov.mandato
     where ciclo_id = new.ciclo_id and cargo = new.cargo and situacao = 'ativo' and id <> new.id;
    if v_n >= 3 then
      raise exception 'Art. 21: o Conselho Fiscal tem no maximo 3 titulares e 3 suplentes';
    end if;
  end if;
  return new;
end $$;
create trigger trg_mandato_valida before insert or update on gov.mandato
  for each row execute function gov.fn_valida_mandato();

create view gov.v_composicao_atual as
select m.cargo, a.nome, m.inicio, m.fim, m.fim - current_date as dias_para_fim
from gov.mandato m
join gov.associado a on a.id = m.associado_id
where m.situacao = 'ativo'
order by m.cargo, a.nome;

-- ---------------------------------------------------------------------
-- ELEIÇÕES (Cap. VI — Art. 28 a 30)
-- ---------------------------------------------------------------------
create table gov.eleicao (
  id             uuid primary key default gen_random_uuid(),
  ano            int  not null,
  data_eleicao   date not null,
  assembleia_id  uuid references gov.assembleia(id),
  ciclo_id       uuid references gov.ciclo_mandato(id),   -- ciclo que resulta da eleição
  status         text not null default 'planejada' check (status in
                  ('planejada','candidaturas','votacao','apurada','empossada')),
  criado_em      timestamptz not null default now(),
  -- Art. 28: eleições até 30 de novembro do ano vigente
  constraint ck_ate_30_nov check (data_eleicao <= make_date(ano, 11, 30))
);

create table gov.candidatura (
  id                         uuid primary key default gen_random_uuid(),
  eleicao_id                 uuid not null references gov.eleicao(id) on delete cascade,
  associado_id               uuid not null references gov.associado(id),
  cargo                      gov.cargo not null,
  rodada                     int not null default 1,       -- Art. 30 par. único: se vencer o "não", nova indicação em 15 dias
  indicado_em                date,
  apresentado_secretaria_em  date,
  votos_concordo             int not null default 0,
  votos_discordo             int not null default 0,
  resultado                  text not null default 'pendente' check (resultado in
                              ('pendente','eleito','rejeitado')),
  criado_em                  timestamptz not null default now()
);

-- Voto "concordo / discordo" (Art. 30). Separação deliberada:
--  eleitor_participacao registra QUEM votou (evita voto duplo)
--  urna registra O QUE foi votado, sem identificar o eleitor.
create table gov.eleitor_participacao (
  eleicao_id   uuid not null references gov.eleicao(id) on delete cascade,
  rodada       int  not null default 1,
  associado_id uuid not null references gov.associado(id),
  votou_em     timestamptz not null default now(),
  primary key (eleicao_id, rodada, associado_id)
);
create table gov.urna (
  id             bigint generated always as identity primary key,
  candidatura_id uuid not null references gov.candidatura(id) on delete cascade,
  concordo       boolean not null
);

create view gov.v_prazos_eleicao as
select e.id as eleicao_id,
       e.ano,
       e.data_eleicao,
       (e.data_eleicao - interval '1 month')::date as indicar_candidatos_ate,   -- Art. 29
       e.data_eleicao - 15                         as apresentar_na_secretaria_ate, -- Art. 29
       make_date(e.ano, 11, 30)                    as limite_estatutario          -- Art. 28
from gov.eleicao e;

-- ---------------------------------------------------------------------
-- DOAÇÕES, CONVÊNIOS E FINANCEIRO (Art. 4, 5, 20, 27)
-- ---------------------------------------------------------------------
create table gov.convenio_doacao (
  id                                   uuid primary key default gen_random_uuid(),
  tipo                                 text not null check (tipo in ('doacao','subvencao','convenio','auxilio')),
  origem_nome                          text not null,
  descricao                            text,
  valor_previsto                       numeric(14,2),
  verba_publica                        boolean not null default false,
  finalidade_vinculada                 text,                 -- Art. 27 §3: aplicar na finalidade vinculada
  aprovado_conselho_em                 date,                 -- Art. 5: conselho
  aprovado_orientacao_espiritual_em    date,                 --        orientação espiritual
  aprovado_coordenacao_geral_em        date,                 --        coordenação geral
  status                               text not null default 'em_analise' check (status in
                                        ('em_analise','aceito','recusado')),
  criado_em                            timestamptz not null default now(),
  constraint ck_aceite_com_tres_aprovacoes check (
    status <> 'aceito' or
    (aprovado_conselho_em is not null
     and aprovado_orientacao_espiritual_em is not null
     and aprovado_coordenacao_geral_em is not null)
  )
);

create table gov.lancamento (
  id                       uuid primary key default gen_random_uuid(),
  data                     date not null,
  tipo                     text not null check (tipo in ('receita','despesa')),
  categoria                text,
  descricao                text not null,
  valor                    numeric(14,2) not null check (valor > 0),
  origem                   gov.origem_recurso not null default 'propria',
  convenio_id              uuid references gov.convenio_doacao(id),
  autorizado_por           text,                              -- Art. 20 b: despesas autorizadas pela coordenação geral
  comprovante_documento_id uuid references gov.documento(id), -- Art. 20 a: escrituração comprovada
  lancado_por              text,
  exercicio                int generated always as (extract(year from data)::int) stored,
  criado_em                timestamptz not null default now(),
  constraint ck_despesa_autorizada check (tipo = 'receita' or autorizado_por is not null)
);
create index on gov.lancamento (exercicio);

create table gov.prestacao_contas (
  id                        uuid primary key default gen_random_uuid(),
  tipo                      text not null check (tipo in
                             ('mensal','trimestral_verba_publica','balancete_anual')),
  exercicio                 int not null,
  periodo_inicio            date not null,
  periodo_fim               date not null,
  documento_id              uuid references gov.documento(id),
  parecer_cf_em             date,                                -- Art. 22 b/c
  parecer_cf_resultado      text check (parecer_cf_resultado in
                             ('aprovado','aprovado_com_ressalvas','reprovado')),
  parecer_cf_texto          text,
  apresentado_assembleia_id uuid references gov.assembleia(id),  -- Art. 11 I e 20 d
  status                    text not null default 'rascunho' check (status in
                             ('rascunho','emitido','com_parecer_cf','aprovado_em_assembleia')),
  criado_em                 timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PATRIMÔNIO (Art. 5 par. único, 12 I, 22 d, 27)
-- ---------------------------------------------------------------------
create table gov.patrimonio (
  id                      uuid primary key default gen_random_uuid(),
  numero_tombo            text unique,
  descricao               text not null,
  categoria               text,
  data_aquisicao          date,
  valor                   numeric(14,2),
  origem                  gov.origem_recurso,
  convenio_id             uuid references gov.convenio_doacao(id),
  local                   text,
  responsavel_id          uuid references gov.associado(id),   -- coordenador de patrimônio
  inalienavel             boolean not null default true,       -- Art. 5 par. único
  situacao                text not null default 'ativo' check (situacao in ('ativo','baixado')),
  baixa_em                date,
  baixa_deliberacao_id    uuid references gov.deliberacao(id),
  parecer_cf_baixa_em     date,                                 -- Art. 22 d: Conselho Fiscal opina
  criado_em               timestamptz not null default now(),
  constraint ck_baixa_autorizada check (
    situacao <> 'baixado' or (baixa_deliberacao_id is not null and parecer_cf_baixa_em is not null)
  )
);

create function gov.fn_valida_baixa_patrimonio() returns trigger language plpgsql as $$
begin
  if new.situacao = 'baixado' and (tg_op = 'INSERT' or old.situacao <> 'baixado') then
    if not exists (
      select 1 from gov.deliberacao d
       where d.id = new.baixa_deliberacao_id
         and d.materia = 'alienacao_bem'
         and d.resultado = 'aprovada'
    ) then
      raise exception 'Baixa de bem permanente exige deliberacao aprovada de alienacao de bem (Art. 5 par. unico e Art. 12 I)';
    end if;
  end if;
  return new;
end $$;
create trigger trg_patrimonio_baixa before insert or update on gov.patrimonio
  for each row execute function gov.fn_valida_baixa_patrimonio();

-- ---------------------------------------------------------------------
-- CONSELHO GERAL E MISSÕES (Art. 25 e 26)
-- ---------------------------------------------------------------------
create table gov.conselho_geral_membro (
  id            uuid primary key default gen_random_uuid(),
  associado_id  uuid not null references gov.associado(id),
  area_pastoral text,
  designado_em  date not null,
  designado_por text not null default 'orientador_espiritual',   -- Art. 26 par. único
  encerrado_em  date
);

create table gov.missao (
  id                            uuid primary key default gen_random_uuid(),
  nome                          text not null,
  data_inicio                   date,
  data_fim                      date,
  coordenador_id                uuid references gov.associado(id),
  coordenador_aprovado_em       date,        -- Art. 26 d: Conselho Geral aprova coordenadores de missões
  status                        text not null default 'planejada' check (status in
                                 ('planejada','em_andamento','concluida','cancelada')),
  criado_em                     timestamptz not null default now()
);

create table gov.missao_equipe (
  missao_id      uuid not null references gov.missao(id) on delete cascade,
  associado_id   uuid not null references gov.associado(id),
  funcao         text not null check (funcao in ('pregador','coordenador_setor','equipe')),
  aprovado_em    date,                       -- Art. 25 b/c
  primary key (missao_id, associado_id, funcao)
);

-- ---------------------------------------------------------------------
-- OBRIGAÇÕES RECORRENTES (calendário de conformidade)
-- ---------------------------------------------------------------------
create table gov.obrigacao_modelo (
  codigo               text primary key,
  titulo               text not null,
  base_estatutaria     text not null,
  recorrencia          text not null check (recorrencia in ('anual','trienal','trimestral','mensal','evento')),
  responsavel          gov.cargo,
  antecedencia_alerta_dias int not null default 30
);

create table gov.obrigacao (
  id                      uuid primary key default gen_random_uuid(),
  modelo_codigo           text not null references gov.obrigacao_modelo(codigo),
  titulo                  text not null,
  base_estatutaria        text not null,
  prazo                   date not null,
  prazo_tipo              text not null check (prazo_tipo in ('estatutario','interno')),
  responsavel_cargo       gov.cargo,
  exercicio               int not null,
  status                  text not null default 'pendente' check (status in
                           ('pendente','cumprida','dispensada')),
  cumprida_em             date,
  evidencia_documento_id  uuid references gov.documento(id),
  observacao              text,
  unique (modelo_codigo, exercicio, prazo)
);
create index on gov.obrigacao (status, prazo);

insert into gov.obrigacao_modelo (codigo, titulo, base_estatutaria, recorrencia, responsavel, antecedencia_alerta_dias) values
 ('CRONOGRAMA_ANUAL',        'Cronograma de atividades do ano seguinte',                    'Art. 24, a',          'anual',      'presidente', 45),
 ('RELATORIO_ANUAL',         'Relatório anual da Diretoria à Assembleia Geral',             'Art. 24, b',          'anual',      'secretario', 45),
 ('AGO_CONVOCACAO',          'Convocar a Assembleia Geral Ordinária (30 dias de antecedência)', 'Arts. 10, 13 II e 14', 'anual',  'presidente', 20),
 ('BALANCETE_PARECER_CF',    'Balancete anual e parecer do Conselho Fiscal',                'Arts. 20 d e 22 b',   'anual',      'tesoureiro', 30),
 ('CONSELHO_GERAL_ANUAL',    'Reunião anual do Conselho Geral',                             'Art. 26, par. único', 'anual',      'presidente', 30),
 ('VERBA_PUBLICA_TRIMESTRAL','Relatório trimestral de verbas públicas (se houver)',         'Art. 20, g',          'trimestral', 'tesoureiro', 15),
 ('REUNIAO_MENSAL_DIRETORIA','Reunião mensal da Diretoria',                                 'Art. 24, par. único', 'mensal',     'presidente', 7),
 ('ELEICAO_INDICACAO',       'Diretoria indica candidatos (1 mês antes da eleição)',        'Art. 29',             'trienal',    'presidente', 20),
 ('ELEICAO_PUBLICACAO',      'Candidatos apresentados na secretaria (15 dias antes)',       'Art. 29',             'trienal',    'secretario', 10),
 ('ELEICAO_REALIZACAO',      'Eleição da Diretoria e do Conselho Fiscal (até 30/11)',       'Art. 28',             'trienal',    'presidente', 30);

-- Gera as obrigações de um exercício. Prazos "interno" são sugestões do sistema
-- (o estatuto não fixa data); prazos "estatutario" vêm direto do texto.
create function gov.gerar_obrigacoes(p_ano int) returns int language plpgsql as $$
declare v_n int;
begin
  with itens(codigo, prazo, tipo) as (
    values
      ('CRONOGRAMA_ANUAL',       make_date(p_ano,11,30), 'estatutario'),
      ('RELATORIO_ANUAL',        make_date(p_ano,11,30), 'estatutario'),
      ('AGO_CONVOCACAO',         make_date(p_ano,10,31), 'estatutario'),
      ('BALANCETE_PARECER_CF',   make_date(p_ano,11,15), 'interno'),
      ('CONSELHO_GERAL_ANUAL',   make_date(p_ano,12,31), 'interno'),
      ('VERBA_PUBLICA_TRIMESTRAL', make_date(p_ano,4,15),  'interno'),
      ('VERBA_PUBLICA_TRIMESTRAL', make_date(p_ano,7,15),  'interno'),
      ('VERBA_PUBLICA_TRIMESTRAL', make_date(p_ano,10,15), 'interno'),
      ('VERBA_PUBLICA_TRIMESTRAL', make_date(p_ano+1,1,15),'interno')
    union all
    select 'REUNIAO_MENSAL_DIRETORIA',
           (make_date(p_ano, g.m, 1) + interval '1 month - 1 day')::date,
           'interno'
      from generate_series(1,12) as g(m)
    union all
    select v.c, v.d, v.t
      from (values
        ('ELEICAO_INDICACAO',   make_date(p_ano,10,30), 'estatutario'),
        ('ELEICAO_PUBLICACAO',  make_date(p_ano,11,15), 'estatutario'),
        ('ELEICAO_REALIZACAO',  make_date(p_ano,11,30), 'estatutario')
      ) as v(c,d,t)
     where exists (select 1 from gov.ciclo_mandato where extract(year from fim) = p_ano)
  )
  insert into gov.obrigacao (modelo_codigo, titulo, base_estatutaria, prazo, prazo_tipo, responsavel_cargo, exercicio)
  select m.codigo, m.titulo, m.base_estatutaria, i.prazo, i.tipo, m.responsavel, p_ano
    from itens i
    join gov.obrigacao_modelo m on m.codigo = i.codigo
   where i.prazo >= current_date   -- só prazos de hoje em diante; datas passadas não viram alerta vencido
  on conflict (modelo_codigo, exercicio, prazo) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------------
-- ALERTAS (alimenta o painel e as notificações)
-- ---------------------------------------------------------------------
create view gov.v_alertas as
select 'obrigacao'::text as origem,
       o.titulo           as descricao,
       o.prazo            as prazo,
       o.id               as referencia_id,
       case when o.prazo < current_date then 'vencida' else 'proxima' end as situacao
  from gov.obrigacao o
  join gov.obrigacao_modelo m on m.codigo = o.modelo_codigo
 where o.status = 'pendente'
   and o.prazo - current_date <= m.antecedencia_alerta_dias
union all
select 'mandato',
       'Mandato termina: ' || a.nome || ' (' || m.cargo::text || ')',
       m.fim, m.id,
       case when m.fim < current_date then 'vencida' else 'proxima' end
  from gov.mandato m
  join gov.associado a on a.id = m.associado_id
 where m.situacao = 'ativo' and m.fim - current_date <= 90
union all
select 'disciplinar_recurso',
       'Prazo de recurso (5 dias) em aberto: ' || a.nome,
       p.prazo_recurso, p.id,
       case when p.prazo_recurso < current_date then 'vencida' else 'proxima' end
  from gov.processo_disciplinar p
  join gov.associado a on a.id = p.associado_id
 where p.status = 'aplicada' and p.recurso_em is null and p.prazo_recurso is not null
union all
select 'disciplinar_assembleia',
       'Assembleia do recurso (30 dias) pendente: ' || a.nome,
       p.prazo_assembleia, p.id,
       case when p.prazo_assembleia < current_date then 'vencida' else 'proxima' end
  from gov.processo_disciplinar p
  join gov.associado a on a.id = p.associado_id
 where p.status = 'em_recurso' and p.assembleia_id is null and p.prazo_assembleia is not null
union all
select 'frequencia',
       'Frequência abaixo de 75%: ' || f.nome || ' (' || f.percentual || '%)',
       make_date(f.ano, 12, 31), f.associado_id, 'proxima'
  from gov.v_frequencia_anual f
 where f.abaixo_do_minimo and f.ano = extract(year from current_date)::int
union all
select 'financeiro',
       'Lançamento sem comprovante: ' || l.descricao,
       l.data, l.id, 'proxima'
  from gov.lancamento l
 where l.comprovante_documento_id is null;

-- ---------------------------------------------------------------------
-- AUDITORIA e housekeeping
-- ---------------------------------------------------------------------
create table gov.auditoria (
  id          bigint generated always as identity primary key,
  tabela      text not null,
  registro_id text,
  operacao    text not null,
  antes       jsonb,
  depois      jsonb,
  usuario     text default current_setting('app.user_id', true),   -- a API faz SET LOCAL app.user_id = ...
  em          timestamptz not null default now()
);

create function gov.fn_auditar() returns trigger language plpgsql as $$
begin
  insert into gov.auditoria (tabela, registro_id, operacao, antes, depois)
  values (
    tg_table_name,
    coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id'),
    tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return null;
end $$;

create function gov.fn_touch() returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
create trigger trg_associado_touch before update on gov.associado
  for each row execute function gov.fn_touch();

-- Auditoria nas tabelas sensíveis. A "urna" fica DE FORA de propósito (sigilo do voto).
do $$
declare t text;
begin
  foreach t in array array[
    'associado','processo_disciplinar','mandato','assembleia','deliberacao',
    'eleicao','candidatura','lancamento','prestacao_contas','patrimonio',
    'convenio_doacao','obrigacao'
  ] loop
    execute format(
      'create trigger trg_%1$s_audit after insert or update or delete on gov.%1$s
         for each row execute function gov.fn_auditar()', t);
  end loop;
end $$;

-- RLS habilitada sem policies: só o service role (servidor) acessa.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'gov' loop
    execute format('alter table gov.%I enable row level security', t);
  end loop;
end $$;
