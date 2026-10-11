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
