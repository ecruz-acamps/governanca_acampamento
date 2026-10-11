import { Flash, type SP } from '@/components/ui';
import { requireUser } from '@/lib/session';
import { trocarSenha } from './actions';

export const dynamic = 'force-dynamic';

export default async function TrocarSenhaPage({ searchParams }: { searchParams: SP }) {
  const u = await requireUser({ permitirTroca: true });
  return (
    <div className="login">
      <div className="box">
        <h1>Trocar senha</h1>
        <p className="muted">
          {u.precisaTrocar
            ? 'Por segurança, defina uma senha só sua antes de continuar.'
            : 'Defina uma nova senha para a sua conta.'}
        </p>
        <form action={trocarSenha}>
          <Flash ok={searchParams.ok} erro={searchParams.erro} />
          <label className="campo">
            Senha atual
            <input name="atual" type="password" autoComplete="current-password" required />
          </label>
          <label className="campo">
            Nova senha
            <input name="nova" type="password" autoComplete="new-password" minLength={12} required />
            <small>Mínimo de 12 caracteres, com letra e também número ou símbolo.</small>
          </label>
          <label className="campo">
            Repita a nova senha
            <input name="repete" type="password" autoComplete="new-password" minLength={12} required />
          </label>
          <button className="btn" type="submit">Salvar nova senha</button>
        </form>
      </div>
    </div>
  );
}
