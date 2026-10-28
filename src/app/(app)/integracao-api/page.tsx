import Link from 'next/link';
import { Chip, Flash, PageHead, type SP } from '@/components/ui';
import { run } from '@/lib/db';
import { fmtDataHora } from '@/lib/format';
import { apiConfigurada, buscarPreFichas, casar, type NucleoBanco } from '@/lib/prefichas';
import { requireSuperadmin } from '@/lib/session';
import { aplicarPrefichas, salvarCodigoNucleo } from './actions';

type Dist = { id: string; titulo: string; ano: number };
type Nuc = NucleoBanco & { separa_origem: boolean; fichas_fixas: number | null; pre_fichas: number; pre_fora: number };
type Log = { em: string; status: string; recebidos: number; aplicados: number; sem_correspondencia: string[]; erro: string | null; titulo: string | null };

export default async function IntegracaoApiPage({ searchParams }: { searchParams: SP & { d?: string; previa?: string } }) {
  const u = await requireSuperadmin();
  const cfg = apiConfigurada();
  let endereco = '—';
  if (cfg.url) {
    try { const x = new URL(cfg.url); endereco = x.origin + x.pathname; } catch { endereco = 'endereço inválido'; }
  }

  const { dists, sel, nucleos, logs } = await run(u.id, async (tx) => {
    const dists = await tx<Dist[]>`select id, titulo, ano from gov.distribuicao_fichas order by ano desc, criado_em desc`;
    const sel = dists.find((d) => d.id === searchParams.d) ?? dists[0] ?? null;
    const nucleos = await tx<Nuc[]>`
      select n.id, n.nome, n.codigo_externo, n.separa_origem, n.fichas_fixas,
             coalesce(p.pre_fichas, 0) as pre_fichas, coalesce(p.pre_fora, 0) as pre_fora
        from gov.nucleo n
        left join gov.distribuicao_pre p on p.nucleo_id = n.id and p.distribuicao_id = ${sel?.id ?? null}
       where n.ativo order by n.tipo, n.nome`;
    const logs = await tx<Log[]>`
      select s.em, s.status, s.recebidos, s.aplicados, s.sem_correspondencia, s.erro, d.titulo
        from gov.api_sincronizacao s left join gov.distribuicao_fichas d on d.id = s.distribuicao_id
       order by s.em desc limit 10`;
    return { dists, sel, nucleos, logs };
  });

  const previa = searchParams.previa && cfg.url ? await buscarPreFichas() : null;
  const casado = previa?.ok ? casar(nucleos, previa.itens) : null;
  const recebidoPor = new Map(casado?.ligados.map((l) => [l.nucleo.id, l.item]) ?? []);

  return (
    <>
      <PageHead titulo="API" sub="Pré-fichas por núcleo vindas de outro sistema · visível só ao superadmin" />
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      <div className="card">
        <h2>Conexão</h2>
        <table><tbody>
          <tr><td className="muted" style={{ width: '30%' }}>Endereço da API</td><td>{cfg.url ? endereco : <Chip tom="warn">não configurado</Chip>}</td></tr>
          <tr><td className="muted">Token</td><td>{cfg.token ? <Chip tom="ok">configurado</Chip> : <Chip tom="warn">não configurado</Chip>}</td></tr>
        </tbody></table>
        <p className="muted" style={{ marginTop: 10 }}>
          O endereço e o token ficam só nas variáveis da Vercel (<code>PREFICHAS_API_URL</code> e <code>PREFICHAS_API_TOKEN</code>),
          nunca no banco nem nesta tela. O formato que o outro sistema deve responder está em <code>docs/api-pre-fichas.md</code>.
        </p>
      </div>

      <div className="card">
        <h2>Buscar pré-fichas</h2>
        {dists.length === 0 ? <p className="vazio">Crie antes uma distribuição em Fichas por núcleo.</p> : (
          <>
            <div className="acoes" style={{ marginBottom: 12 }}>
              {dists.map((d) => (
                <Link key={d.id} className={`btn ${sel?.id === d.id ? '' : 'sec'} mini`} href={`/integracao-api?d=${d.id}`}>{d.titulo}</Link>
              ))}
            </div>
            {sel && (
              <Link className="btn" href={`/integracao-api?d=${sel.id}&previa=1`} aria-disabled={!cfg.url}>
                Consultar a API (prévia, não grava)
              </Link>
            )}
          </>
        )}

        {previa && !previa.ok && <p role="alert" style={{ color: 'var(--bad-ink)', marginTop: 12 }}>{previa.erro}</p>}

        {previa?.ok && casado && sel && (
          <div className="tabela" style={{ marginTop: 14 }}>
            <p className="muted">Resposta recebida{previa.atualizadoEm ? `, atualizada em ${previa.atualizadoEm}` : ''}: {previa.itens.length} núcleos. Nada foi gravado ainda.</p>
            <table>
              <thead><tr><th>Núcleo</th><th>Hoje</th><th>API</th><th>Situação</th></tr></thead>
              <tbody>
                {nucleos.map((n) => {
                  const it = recebidoPor.get(n.id);
                  const hoje = n.pre_fichas + (n.separa_origem ? n.pre_fora : 0);
                  const novo = it ? it.pre_fichas + (n.separa_origem ? it.pre_fora : 0) : null;
                  return (
                    <tr key={n.id}>
                      <td>{n.nome}{n.fichas_fixas !== null && <span className="muted"> (fixo)</span>}</td>
                      <td>{hoje}</td>
                      <td>{novo ?? '—'}</td>
                      <td>{!it ? <Chip tom="warn">sem retorno</Chip> : novo === hoje ? <Chip>igual</Chip> : <Chip tom="ok">muda</Chip>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {casado.semCorrespondencia.length > 0 && (
              <p role="alert" style={{ color: 'var(--bad-ink)', marginTop: 10 }}>
                A API mandou {casado.semCorrespondencia.length} item(ns) que não batem com nenhum núcleo:{' '}
                {casado.semCorrespondencia.map((i) => i.codigo ?? i.nome).join(', ')}. Preencha o <b>código externo</b> do núcleo abaixo.
              </p>
            )}
            <form action={aplicarPrefichas} style={{ marginTop: 14 }}>
              <input type="hidden" name="d" value={sel.id} />
              <button className="btn" type="submit">Aplicar em “{sel.titulo}”</button>
              <span className="muted"> — sobrescreve as pré-fichas dos núcleos listados como “muda” ou “igual”.</span>
            </form>
          </div>
        )}
      </div>

      <div className="card tabela">
        <h2>Como a API identifica cada núcleo</h2>
        <p className="muted">O sistema liga pelo <b>código externo</b>, se houver, ou pelo nome (sem acento e sem diferenciar maiúsculas). Preencha o código quando os nomes forem diferentes nos dois sistemas.</p>
        <table>
          <thead><tr><th>Núcleo</th><th>Código externo</th></tr></thead>
          <tbody>
            {nucleos.map((n) => (
              <tr key={n.id}>
                <td>{n.nome}</td>
                <td>
                  <form action={salvarCodigoNucleo} className="acoes">
                    <input type="hidden" name="id" value={n.id} /><input type="hidden" name="d" value={sel?.id ?? ''} />
                    <input type="text" name="codigo" defaultValue={n.codigo_externo ?? ''} placeholder="igual ao nome" style={{ maxWidth: 200 }} />
                    <button className="btn sec mini" type="submit">Salvar</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card tabela">
        <h2>Últimas sincronizações</h2>
        {logs.length === 0 ? <p className="vazio">Nenhuma ainda.</p> : (
          <table>
            <thead><tr><th>Quando</th><th>Distribuição</th><th>Resultado</th></tr></thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={i}>
                  <td>{fmtDataHora(l.em)}</td>
                  <td>{l.titulo ?? '—'}</td>
                  <td>
                    {l.status === 'ok'
                      ? <>{l.aplicados} de {l.recebidos} aplicados{l.sem_correspondencia.length > 0 && <span className="muted"> · sem correspondência: {l.sem_correspondencia.join(', ')}</span>}</>
                      : <Chip tom="bad">{l.erro}</Chip>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
