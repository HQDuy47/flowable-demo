import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Ic, type IconName } from './icons';

/** Nút thao tác có icon. `to` → link trong app; `primary` nút xanh; `danger` nút đỏ. */
export function Cmd({ icon, label, onClick, to, primary, danger, busy, disabled }: {
  icon: IconName; label: string; onClick?: () => void; to?: string;
  primary?: boolean; danger?: boolean; busy?: boolean; disabled?: boolean;
}) {
  const cls = `cmd${primary ? ' cmd--primary' : ''}${danger ? ' cmd--danger' : ''}`;
  const inner = (
    <>
      {busy ? <span className="spinner keep-motion" aria-hidden="true" /> : <Ic name={icon} />}
      <span>{label}</span>
    </>
  );
  if (to) return <Link className={cls} to={to}>{inner}</Link>;
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled || busy} aria-busy={busy || undefined}>
      {inner}
    </button>
  );
}

/** Hàng nút thao tác. */
export function CommandBar({ children }: { children: ReactNode }) {
  return <div className="cmdbar" role="toolbar" aria-label="Actions">{children}</div>;
}
