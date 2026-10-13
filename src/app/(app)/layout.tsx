import LogoutButton from '@/components/LogoutButton';
import NavLinks, { type Item } from '@/components/NavLinks';
import { can, PAPEL_LABEL } from '@/lib/perms';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const itens: Item[] = [];
  if (can(u.papel, 'painel:ler')) itens.push({ href: '/', label: 'Painel' });
  if (u.associadoId) {
    itens.push({ href: '/portal', label: 'Meu portal' });
    itens.push({ href: '/portal/carteirinha', label: 'Minha carteirinha' });
    itens.push({ href: '/portal/presenca', label: 'Minhas presenças' });
  }
  if (can(u.papel, 'associados:ler')) itens.push({ href: '/associados', label: 'Associados' });
  if (can(u.papel, 'reunioes:ler')) itens.push({ href: '/reunioes', label: 'Reuniões e presença' });
  if (can(u.papel, 'mandatos:ler')) itens.push({ href: '/mandatos', label: 'Mandatos' });
  if (can(u.papel, 'assembleias:ler')) itens.push({ href: '/assembleias', label: 'Assembleias' });
  if (can(u.papel, 'conselho:ler')) itens.push({ href: '/conselho', label: 'Conselho Geral e missões' });
  if (can(u.papel, 'eleicoes:ler')) itens.push({ href: '/eleicoes', label: 'Eleições' });
  if (can(u.papel, 'disciplinar:ler')) itens.push({ href: '/disciplinar', label: 'Disciplinar' });
  if (can(u.papel, 'financeiro:ler')) itens.push({ href: '/financeiro', label: 'Financeiro' });
  if (can(u.papel, 'convenios:ler')) itens.push({ href: '/convenios', label: 'Convênios e doações' });
  if (can(u.papel, 'financeiro:ler')) itens.push({ href: '/prestacoes', label: 'Prestação de contas' });
  if (can(u.papel, 'patrimonio:ler')) itens.push({ href: '/patrimonio', label: 'Patrimônio' });
  if (can(u.papel, 'calendario:ler')) itens.push({ href: '/calendario', label: 'Calendário de obrigações' });
  if (can(u.papel, 'usuarios:gerir')) itens.push({ href: '/usuarios', label: 'Usuários' });
  if (can(u.papel, 'auditoria:ler')) itens.push({ href: '/auditoria', label: 'Auditoria' });

  return (
    <div className="shell">
      <aside className="side">
        <div className="marca">
          Governança
          <small>Assoc. dos Campistas São Padre Pio</small>
        </div>
        <nav className="navlinks" aria-label="Menu principal">
          <NavLinks itens={itens} />
        </nav>
        <div className="rodape">
          <b>{u.nome}</b>
          <span>{PAPEL_LABEL[u.papel]}</span>
          <LogoutButton />
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
