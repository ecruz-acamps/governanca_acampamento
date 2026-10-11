'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type Item = { href: string; label: string };

export default function NavLinks({ itens }: { itens: Item[] }) {
  const atual = usePathname();
  return (
    <>
      {itens.map((i) => {
        const ativo = i.href === '/' ? atual === '/' : atual.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={`nav${ativo ? ' ativo' : ''}`}>
            {i.label}
          </Link>
        );
      })}
    </>
  );
}
