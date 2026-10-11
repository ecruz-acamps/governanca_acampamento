// Segredo de sessão. Usa NEXTAUTH_SECRET se existir; senão, o primeiro valor secreto de servidor
// disponível (todos vêm da integração Supabase–Vercel e nunca vão ao navegador).
const CANDIDATOS = [
  'NEXTAUTH_SECRET',
  'SUPABASE_JWT_SECRET',
  'POSTGRES_PASSWORD',
  'POSTGRES_URL',
  'DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'POSTGRES_PRISMA_URL',
];

export function segredoSessao(): string {
  for (const k of CANDIDATOS) {
    const v = process.env[k];
    if (v && v.length >= 16) return 'gov-spp|' + v;
  }
  return 'sem-segredo-configurado-defina-NEXTAUTH_SECRET';
}
