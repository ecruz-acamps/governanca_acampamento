import { createHash } from 'node:crypto';

// Segredo de sessão: usa NEXTAUTH_SECRET se existir; senão deriva de uma credencial só do servidor
// (a conexão do banco), para o app funcionar só com a integração Supabase–Vercel.
const base = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const segredo =
  process.env.NEXTAUTH_SECRET ||
  (base ? createHash('sha256').update('governanca-spp|' + base).digest('base64') : '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: segredo ? { NEXTAUTH_SECRET: segredo } : {},
  experimental: {
    serverComponentsExternalPackages: ['@node-rs/argon2', 'postgres'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
