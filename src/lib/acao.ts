import { redirect } from 'next/navigation';
import { mensagemErro } from '@/lib/erros';
import { msg } from '@/lib/form';

/** Roda a gravação e devolve a mensagem de erro (ou null se deu certo). */
export async function tentar(fn: () => Promise<void>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return mensagemErro(e);
  }
}

/** Volta para a página com um aviso de sucesso ou de erro. */
export function voltar(caminho: string, ok: string, erro?: string | null): never {
  const sep = caminho.includes('?') ? '&' : '?';
  redirect(`${caminho}${sep}${erro ? 'erro=' + msg(erro) : 'ok=' + msg(ok)}`);
}
