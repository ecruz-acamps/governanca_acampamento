'use client';

import { signOut } from 'next-auth/react';

export default function LogoutButton() {
  return (
    <button type="button" onClick={() => signOut({ callbackUrl: '/login' })}>
      Sair
    </button>
  );
}
