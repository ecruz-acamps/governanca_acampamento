import type { ReactNode } from 'react';

export function Flash({ ok, erro }: { ok?: string; erro?: string }) {
  if (erro) return <div className="flash erro" role="alert">{erro}</div>;
  if (ok) return <div className="flash ok" role="status">{ok}</div>;
  return null;
}

export function Chip({ tom = 'mute', children }: { tom?: string; children: ReactNode }) {
  return <span className={`chip ${tom}`}>{children}</span>;
}

export function PageHead({ titulo, sub, children }: { titulo: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="head">
      <div>
        <h1>{titulo}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {children && <div className="acoes">{children}</div>}
    </div>
  );
}

export function Campo({
  label,
  dica,
  className,
  children,
}: {
  label: string;
  dica?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`campo ${className ?? ''}`}>
      {label}
      {children}
      {dica && <small>{dica}</small>}
    </label>
  );
}

export type SP = { ok?: string; erro?: string; area?: string };
