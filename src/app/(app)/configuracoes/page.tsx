import { Campo, Flash, PageHead, type SP } from '@/components/ui';
import { lerPesoFora } from '@/lib/config';
import { run } from '@/lib/db';
import { can } from '@/lib/perms';
import { requirePerm } from '@/lib/session';
import { salvarPesoFora } from './actions';

export default async function ConfiguracoesPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePerm('fichas:ler');
  const podeEscrever = can(u.papel, 'fichas:escrever', u.superadmin, u.areaPatrimonio);
  const peso = await run(u.id, (tx) => lerPesoFora(tx));
  const fmt = (x: number) => String(Math.round(x * 100) / 100).replace('.', ',');

  return (
    <>
      <PageHead titulo="Configurações" sub="Ajustes que valem para todo o sistema" />
      <Flash ok={searchParams.ok} erro={searchParams.erro} />

      <form action={salvarPesoFora} className="card">
        <h2>Divisão das fichas</h2>
        <fieldset disabled={!podeEscrever}>
          <div className="form-grid">
            <Campo label="Peso das pré-fichas de fora da Arquidiocese" dica="de 0 a 1; com 0,5 cada pré-ficha de fora vale metade de uma de dentro">
              <input type="text" name="peso_fora" inputMode="decimal" defaultValue={fmt(peso)} required />
            </Campo>
          </div>
          {podeEscrever && <div style={{ marginTop: 14 }}><button className="btn" type="submit">Salvar</button></div>}
        </fieldset>
        <p className="muted" style={{ marginTop: 10 }}>
          Vale para os núcleos que separam dentro e fora da Arquidiocese (Anitápolis e Garopaba). Exemplo com peso {fmt(peso)}: 10 pré-fichas de
          dentro e 6 de fora contam como {fmt(10 + 6 * peso)}. Com 1, não há desconto; com 0, as de fora não entram na divisão.
        </p>
      </form>
    </>
  );
}
