'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';

const MOTIVO = 'Link inválido, expirado ou já utilizado. Volte ao sistema interno e clique de novo.';

export default function SsoPage() {
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    // O token vem no fragmento (#t=...), que não vai para logs de servidor.
    const token = new URLSearchParams(window.location.hash.slice(1)).get('t');
    window.history.replaceState(null, '', window.location.pathname);
    if (!token) {
      setErro(MOTIVO);
      return;
    }
    signIn('sso', { token, redirect: false }).then((r) => {
      if (r?.ok && !r.error) window.location.replace('/');
      else setErro(MOTIVO);
    });
  }, []);

  return (
    <div className="login">
      <div className="box">
        <h1>Governança</h1>
        {erro ? (
          <>
            <div className="flash erro" role="alert" style={{ marginTop: 14 }}>{erro}</div>
            <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
              Ou <a href="/login">entre com e-mail e senha</a>.
            </p>
          </>
        ) : (
          <p className="muted">Entrando…</p>
        )}
      </div>
    </div>
  );
}
