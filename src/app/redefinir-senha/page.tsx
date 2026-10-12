'use client';

import { useEffect, useState } from 'react';
import { redefinirComToken } from './actions';

export default function RedefinirSenhaPage() {
  const [token, setToken] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const m = /[#&]t=([^&]+)/.exec(window.location.hash);
    setToken(m ? decodeURIComponent(m[1]) : '');
    // Tira o token da barra de endereço e do histórico.
    if (m) history.replaceState(null, '', window.location.pathname);
  }, []);

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setErro(null);
    setEnviando(true);
    const f = new FormData(e.currentTarget);
    const r = await redefinirComToken(token, String(f.get('nova') ?? ''), String(f.get('repete') ?? ''));
    setEnviando(false);
    if (r.erro) setErro(r.erro);
    else window.location.href = '/login?ok=1';
  }

  return (
    <div className="login">
      <div className="box">
        <h1>Nova senha</h1>
        {token === null && <p className="muted">Carregando…</p>}
        {token === '' && (
          <>
            <div className="flash erro">Link inválido. Peça um novo em “Esqueci minha senha”.</div>
            <p><a href="/esqueci-senha">Pedir novo link</a></p>
          </>
        )}
        {token && (
          <form onSubmit={salvar}>
            <p className="muted">Mínimo de 12 caracteres, com letras e também números ou símbolos.</p>
            {erro && <div className="flash erro" role="alert">{erro}</div>}
            <label className="campo">
              Nova senha
              <input name="nova" type="password" autoComplete="new-password" minLength={12} required autoFocus />
            </label>
            <label className="campo">
              Repita a nova senha
              <input name="repete" type="password" autoComplete="new-password" minLength={12} required />
            </label>
            <button className="btn" type="submit" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar nova senha'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
