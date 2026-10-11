export type Papel =
  | 'admin'
  | 'presidente'
  | 'vice_presidente'
  | 'secretario'
  | 'tesoureiro'
  | 'conselho_fiscal'
  | 'coord_patrimonio'
  | 'coord_eclesiastico'
  | 'associado';

export const PAPEIS: Papel[] = [
  'admin',
  'presidente',
  'vice_presidente',
  'secretario',
  'tesoureiro',
  'conselho_fiscal',
  'coord_patrimonio',
  'coord_eclesiastico',
  'associado',
];

export const PAPEL_LABEL: Record<Papel, string> = {
  admin: 'Administrador',
  presidente: 'Presidente',
  vice_presidente: 'Vice-presidente',
  secretario: 'Secretário(a)',
  tesoureiro: 'Tesoureiro(a)',
  conselho_fiscal: 'Conselho Fiscal',
  coord_patrimonio: 'Coord. de patrimônio',
  coord_eclesiastico: 'Coord. eclesiástico',
  associado: 'Associado',
};

const EQUIPE: Papel[] = [
  'admin',
  'presidente',
  'vice_presidente',
  'secretario',
  'tesoureiro',
  'conselho_fiscal',
  'coord_patrimonio',
  'coord_eclesiastico',
];

const PERMS = {
  'painel:ler': EQUIPE,
  'associados:ler': EQUIPE,
  'associados:escrever': ['admin', 'presidente', 'vice_presidente', 'secretario', 'coord_eclesiastico'],
  'reunioes:ler': EQUIPE,
  'reunioes:escrever': ['admin', 'presidente', 'vice_presidente', 'secretario'],
  'mandatos:ler': EQUIPE,
  'mandatos:escrever': ['admin', 'presidente', 'secretario'],
  'calendario:ler': EQUIPE,
  'calendario:escrever': ['admin', 'presidente', 'vice_presidente', 'secretario', 'tesoureiro'],
  'assembleias:ler': EQUIPE,
  'assembleias:escrever': ['admin', 'presidente', 'vice_presidente', 'secretario'],
  'disciplinar:ler': ['admin', 'presidente', 'vice_presidente', 'secretario', 'coord_eclesiastico'],
  'disciplinar:escrever': ['admin', 'presidente', 'vice_presidente', 'coord_eclesiastico'],
  'convenios:ler': EQUIPE,
  'convenios:escrever': ['admin', 'presidente', 'vice_presidente', 'tesoureiro'],
  'financeiro:ler': ['admin', 'presidente', 'vice_presidente', 'secretario', 'tesoureiro', 'conselho_fiscal'],
  'financeiro:escrever': ['admin', 'presidente', 'tesoureiro'],
  'parecer:escrever': ['admin', 'conselho_fiscal'],
  'patrimonio:ler': EQUIPE,
  'patrimonio:escrever': ['admin', 'presidente', 'coord_patrimonio'],
  'usuarios:gerir': ['admin'],
  'auditoria:ler': ['admin'],
} as const satisfies Record<string, readonly Papel[]>;

export type Perm = keyof typeof PERMS;

export function can(papel: Papel, perm: Perm): boolean {
  return (PERMS[perm] as readonly Papel[]).includes(papel);
}
