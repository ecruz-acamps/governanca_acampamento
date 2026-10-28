import type { Metadata, Viewport } from 'next';
import './globals.css';
import RegistrarSW from '@/components/RegistrarSW';

export const metadata: Metadata = {
  title: 'Governança — Associação dos Campistas São Padre Pio',
  robots: { index: false, follow: false },
  applicationName: 'Governança',
  // ?v=2 força o navegador a trocar o ícone antigo que ficou guardado
  icons: {
    icon: [
      { url: '/icons/favicon-32.png?v=2', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-48.png?v=2', sizes: '48x48', type: 'image/png' },
      { url: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico?v=2',
    apple: '/icons/apple-touch-icon.png?v=2',
  },
  appleWebApp: { capable: true, title: 'Governança', statusBarStyle: 'default' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#16314d' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:wght@500;600&family=Public+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
