import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { Chip, PageHead } from '@/components/ui';
import { run } from '@/lib/db';
import { codigoCarteirinha } from '@/lib/carteirinha';
import { fmtData } from '@/lib/format';
import { requireAssociado } from '@/lib/session';

export default async function CarteirinhaPage() {
  const u = await requireAssociado();
  const [a] = await run(u.id, (tx) => tx<{ nome: string; status: string; data_admissao: string | null; data_promessa: string | null }[]>`
    select nome, status::text, data_admissao, data_promessa from gov.associado where id = ${u.associadoId}
  `);
  if (!a) return <p className="vazio">Cadastro não encontrado.</p>;
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const url = `${proto}://${host}/verificar/${codigoCarteirinha(u.associadoId)}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#16314d', light: '#ffffff' } });
  const ativo = a.status === 'associado';

  return (
    <>
      <PageHead titulo="Minha carteirinha" sub="Mostre o QR code para conferirem que você é associado" />
      <div className="card" style={{ maxWidth: 380, textAlign: 'center' }}>
        <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Associação dos Campistas São Padre Pio</div>
        <h2 style={{ margin: '10px 0 4px' }}>{a.nome}</h2>
        <Chip tom={ativo ? 'ok' : 'warn'}>{ativo ? 'associado ativo' : a.status.replaceAll('_', ' ')}</Chip>
        <div style={{ width: 220, margin: '16px auto' }} dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="muted">
          {a.data_admissao && <>Admissão: {fmtData(a.data_admissao)}</>}
          {a.data_promessa && <><br />Promessa: {fmtData(a.data_promessa)}</>}
        </p>
        <p className="muted" style={{ fontSize: 12 }}>A situação mostrada na conferência é sempre a de hoje.</p>
      </div>
    </>
  );
}
