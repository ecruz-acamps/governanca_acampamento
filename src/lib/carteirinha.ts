import { createHmac, timingSafeEqual } from 'crypto';
import { segredoSessao } from '@/lib/segredo';
import { isUuid } from '@/lib/form';

function assinatura(id: string): string {
  return createHmac('sha256', segredoSessao() + '|carteirinha').update(id).digest('base64url').slice(0, 22);
}

/** Código do QR da carteirinha: id do associado + assinatura. Não dá para forjar sem o segredo. */
export function codigoCarteirinha(associadoId: string): string {
  return `${associadoId}.${assinatura(associadoId)}`;
}

export function lerCodigo(codigo: string): string | null {
  const [id, sig] = codigo.split('.');
  if (!id || !sig || !isUuid(id)) return null;
  const esperado = Buffer.from(assinatura(id));
  const recebido = Buffer.from(sig);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return null;
  return id;
}
