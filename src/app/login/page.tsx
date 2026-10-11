'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const f = new FormData(e.currentTarget);
    const r = await signIn('credentials', {
      email: String(f.get('email') ?? ''),
      senha: String(f.get('senha') ?? ''),
      redirect: false,
    });
    setEnviando(false);
    if (r?.ok && !r.error) {
      window.location.href = '/';
    } else {
      setErro('E-mail ou senha incorretos, ou conta temporariamente bloqueada.');
    }
  }

  return (
    <div className="login">
      <div className="box">
        <h1>Governança</h1>
        <p className="muted">Associação dos Campistas São Padre Pio</p>
        <form onSubmit={entrar}>
          {erro && <div className="flash erro" role="alert">{erro}</div>}
          <label className="campo">
            E-mail
            <input name="email" type="email" autoComplete="username" required autoFocus />
          </label>
          <label className="campo">
            Senha
            <input name="senha" type="password" autoComplete="current-password" required />
          </label>
          <button className="btn" type="submit" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
          Conta nova sem senha? <a href="/primeiro-acesso">Primeiro acesso</a>
        </p>
      </div>
    </div>
  );
}
