import { run } from '@/lib/db';
import { lerCodigo } from '@/lib/carteirinha';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Conferência de carteirinha' };

// Página pública: confirma só o nome e se a pessoa é associada hoje. O código é assinado e não dá para forjar.
export default async function VerificarPage({ params }: { params: { codigo: string } }) {
  const id = lerCodigo(decodeURIComponent(params.codigo));
  const a = id
    ? (await run(null, (tx) => tx<{ nome: string; status: string }[]>`select nome, status::text from gov.associado where id = ${id}`))[0]
    : undefined;
  const ativo = a?.status === 'associado';
  const suspenso = a?.status === 'suspenso';

  return (
    <div className="login">
      <div className="box" style={{ textAlign: 'center' }}>
        <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Associação dos Campistas São Padre Pio</div>
        {!a ? (
          <>
            <h1 style={{ margin: '14px 0 6px' }}>Carteirinha inválida</h1>
            <p className="muted">Este código não foi reconhecido.</p>
          </>
        ) : (
          <>
            <h1 style={{ margin: '14px 0 6px' }}>{a.nome}</h1>
            <span className={`chip ${ativo ? 'ok' : 'warn'}`}>
              {ativo ? 'Associado(a) ativo(a)' : suspenso ? 'Associado(a) suspenso(a)' : 'Não é associado(a) ativo(a)'}
            </span>
            <p className="muted" style={{ marginTop: 14 }}>Conferido em {new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.</p>
          </>
        )}
      </div>
    </div>
  );
}
