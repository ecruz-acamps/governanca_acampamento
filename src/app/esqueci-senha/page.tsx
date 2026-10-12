import Link from 'next/link';
import { Flash, type SP } from '@/components/ui';
import { pedirRedefinicao } from './actions';

export const metadata = { title: 'Esqueci minha senha' };

export default function EsqueciSenhaPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="login">
      <div className="box">
        <h1>Esqueci minha senha</h1>
        <p className="muted">Digite o e-mail da sua conta. Enviaremos um link para criar uma nova senha.</p>
        <Flash ok={searchParams.ok} erro={searchParams.erro} />
        <form action={pedirRedefinicao}>
          <label className="campo">
            E-mail
            <input name="email" type="email" autoComplete="username" required autoFocus />
          </label>
          <button className="btn" type="submit">Enviar link</button>
        </form>
        <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
          <Link href="/login">Voltar para o login</Link>
        </p>
      </div>
    </div>
  );
}
