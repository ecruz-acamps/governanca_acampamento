export const STATUS_LABEL: Record<string, string> = {
  interessado: 'Interessado',
  em_acompanhamento: 'Em acompanhamento',
  associado: 'Associado',
  suspenso: 'Suspenso',
  excluido: 'Excluído',
  desligado: 'Desligado',
};

export const STATUS_TOM: Record<string, string> = {
  interessado: 'mute',
  em_acompanhamento: 'warn',
  associado: 'ok',
  suspenso: 'bad',
  excluido: 'bad',
  desligado: 'mute',
};

export const ACAMPAMENTO_LABEL: Record<string, string> = {
  senior: 'Sênior',
  juvenil: 'Juvenil',
  fac: 'FAC',
  casais: 'Casais',
  mirim: 'Mirim',
  outro: 'Outro',
};

export const REUNIAO_LABEL: Record<string, string> = {
  mensal: 'Reunião mensal',
  diretoria: 'Reunião da Diretoria',
  conselho_geral: 'Conselho Geral',
  cpp: 'CPP',
  missa_campistas: 'Missa com os campistas',
  outra: 'Outra',
};

export const CARGO_LABEL: Record<string, string> = {
  presidente: 'Presidente',
  vice_presidente: 'Vice-presidente',
  secretario: 'Secretário',
  segundo_secretario: '2º secretário',
  tesoureiro: 'Tesoureiro',
  segundo_tesoureiro: '2º tesoureiro',
  coord_patrimonio_1: 'Coord. de patrimônio',
  coord_patrimonio_2: '2º coord. de patrimônio',
  coord_eclesiastico: 'Coord. eclesiástico',
  fiscal_titular: 'Conselho Fiscal (titular)',
  fiscal_suplente: 'Conselho Fiscal (suplente)',
};

/** Os 9 cargos da Diretoria (Art. 16), na ordem do estatuto. */
export const DIRETORIA = [
  'presidente',
  'vice_presidente',
  'secretario',
  'segundo_secretario',
  'tesoureiro',
  'segundo_tesoureiro',
  'coord_patrimonio_1',
  'coord_patrimonio_2',
  'coord_eclesiastico',
] as const;

export const FISCAL = ['fiscal_titular', 'fiscal_suplente'] as const;

export function fmtData(d?: string | null): string {
  if (!d) return '—';
  const [a, m, dia] = d.slice(0, 10).split('-');
  return `${dia}/${m}/${a}`;
}

export function fmtDataHora(d?: Date | string | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(d));
}

/** Data de hoje (AAAA-MM-DD) no fuso de São Paulo. */
export function hoje(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

export function anoAtual(): number {
  return Number(hoje().slice(0, 4));
}

export const MATERIA_LABEL: Record<string, string> = {
  contas_anuais: 'Contas anuais',
  eleicao_posse: 'Eleição e posse',
  proposta_atividades: 'Proposta de atividades',
  alienacao_bem: 'Alienação de bem',
  recurso_disciplinar: 'Recurso disciplinar',
  alteracao_estatuto: 'Alteração do estatuto',
  destituicao_administrador: 'Destituição de administrador',
  admissao_associado: 'Admissão de associado',
  exclusao_associado: 'Exclusão de associado',
  aceite_doacao_convenio: 'Aceite de doação/convênio',
  outra: 'Outra matéria',
};

export const MEDIDA_LABEL: Record<string, string> = {
  advertencia: 'Advertência',
  suspensao: 'Suspensão',
  exclusao: 'Exclusão',
};

export const MOTIVO_LABEL: Record<string, string> = {
  dano_moral_material: 'Dano moral ou material (Art. 8 §1 a)',
  faltas_reunioes: 'Faltas às reuniões (Art. 8 §1 b)',
  uso_indevido_associacao: 'Uso indevido da associação (Art. 8 §1 c)',
  ato_incompativel_objetivos: 'Ato incompatível com os objetivos (Art. 8 §1 d)',
  descumprimento_estatuto: 'Descumprimento do estatuto (Art. 7 §1)',
  discordia_ou_quebra_de_sigilo: 'Discórdia ou quebra de sigilo (Art. 24 d)',
  outro: 'Outro',
};

export const CONVOCADA_POR_LABEL: Record<string, string> = {
  presidente: 'Presidente',
  diretoria: 'Diretoria',
  conselho_geral: 'Conselho Geral',
  um_quinto_associados: '1/5 dos associados',
};

export const CANAIS = ['Reuniões mensais', 'Convites', 'Missas'] as const;

export const ASSEMBLEIA_STATUS: Record<string, { rotulo: string; tom: string }> = {
  convocada: { rotulo: 'Convocada', tom: 'warn' },
  instalada: { rotulo: 'Instalada', tom: 'ok' },
  realizada: { rotulo: 'Realizada', tom: 'ok' },
  sem_quorum: { rotulo: 'Sem quórum', tom: 'bad' },
  cancelada: { rotulo: 'Cancelada', tom: 'mute' },
};

export const STATUS_PROC: Record<string, { rotulo: string; tom: string }> = {
  aberto: { rotulo: 'Em apuração', tom: 'warn' },
  aplicada: { rotulo: 'Medida aplicada', tom: 'bad' },
  em_recurso: { rotulo: 'Em recurso', tom: 'warn' },
  encerrada: { rotulo: 'Encerrado', tom: 'mute' },
};


export const ORIGEM_LABEL: Record<string, string> = {
  propria: 'Recurso próprio',
  doacao: 'Doação',
  verba_publica: 'Verba pública',
  convenio: 'Convênio',
};

export const CONVENIO_TIPO_LABEL: Record<string, string> = {
  doacao: 'Doação',
  subvencao: 'Subvenção',
  convenio: 'Convênio',
  auxilio: 'Auxílio',
};

export const CONVENIO_STATUS: Record<string, { rotulo: string; tom: string }> = {
  em_analise: { rotulo: 'Em análise', tom: 'warn' },
  aceito: { rotulo: 'Aceito', tom: 'ok' },
  recusado: { rotulo: 'Recusado', tom: 'bad' },
};

export const PRESTACAO_TIPO_LABEL: Record<string, string> = {
  mensal: 'Prestação mensal',
  trimestral_verba_publica: 'Verba pública (trimestral)',
  balancete_anual: 'Balancete anual',
};

export const PRESTACAO_STATUS: Record<string, { rotulo: string; tom: string }> = {
  rascunho: { rotulo: 'Rascunho', tom: 'mute' },
  emitido: { rotulo: 'Emitido', tom: 'warn' },
  com_parecer_cf: { rotulo: 'Com parecer do CF', tom: 'ok' },
  aprovado_em_assembleia: { rotulo: 'Aprovado em assembleia', tom: 'ok' },
};

export function fmtMoeda(v: number | string | null | undefined): string {
  if (v == null || v === '') return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** "1.234,56" ou "1234.56" → número (ou null). */
export function lerValor(txt: string | null): number | null {
  if (!txt) return null;
  const limpo = txt.replace(/[R$\s]/g, '');
  const n = limpo.includes(',') ? Number(limpo.replace(/\./g, '').replace(',', '.')) : Number(limpo);
  return Number.isFinite(n) ? n : null;
}

export const ELEICAO_STATUS: Record<string, { rotulo: string; tom: string }> = {
  planejada: { rotulo: 'planejada', tom: 'mute' },
  candidaturas: { rotulo: 'recebendo candidaturas', tom: 'warn' },
  votacao: { rotulo: 'votação aberta', tom: 'warn' },
  apurada: { rotulo: 'apurada', tom: 'ok' },
  empossada: { rotulo: 'empossada', tom: 'ok' },
};

export const MISSAO_STATUS: Record<string, { rotulo: string; tom: string }> = {
  planejada: { rotulo: 'Planejada', tom: 'mute' },
  em_andamento: { rotulo: 'Em andamento', tom: 'ok' },
  concluida: { rotulo: 'Concluída', tom: 'ok' },
  cancelada: { rotulo: 'Cancelada', tom: 'bad' },
};

/** Áreas de patrimônio (cada coordenador de patrimônio cuida de uma). */
export const AREAS_PATRIMONIO: Record<string, string> = {
  manutencao: 'Manutenção',
  cozinha: 'Cozinha',
  capela: 'Capela',
  musica: 'Música',
  teatro: 'Teatro',
  animacao: 'Animação',
  farmacia: 'Farmácia',
  loja: 'Loja',
  comunicacao: 'Comunicação',
  obras: 'Obras',
  secretaria: 'Secretaria',
  tropa_de_elite: 'Tropa de Elite',
};
