import { Flash, type SP } from '@/components/ui';
import { definirPrimeiraSenha } from './actions';

export const dynamic = 'force-dynamic';

export default function PrimeiroAcessoPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="login">
      <div className="box">
        <h1>Primeiro acesso</h1>
        <p className="muted">
          Defina a senha de uma conta ainda sem senha. Você precisa do código de acesso
          cadastrado na Vercel (variável SETUP_TOKEN).
        </p>
        <form action={definirPrimeiraSenha}>
          <Flash ok={searchParams.ok} erro={searchParams.erro} />
          <label className="campo">
            E-mail
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label className="campo">
            Código de acesso
            <input name="codigo" type="password" autoComplete="off" required />
          </label>
          <label className="campo">
            Nova senha
            <input name="nova" type="password" autoComplete="new-password" minLength={12} required />
            <small>Mínimo de 12 caracteres, com letra e também número ou símbolo.</small>
          </label>
          <label className="campo">
            Repita a senha
            <input name="repete" type="password" autoComplete="new-password" minLength={12} required />
          </label>
          <button className="btn" type="submit">Definir senha</button>
        </form>
      </div>
    </div>
  );
}
