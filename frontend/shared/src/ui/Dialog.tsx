import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Hộp thoại modal (thẻ <dialog> gốc: giữ focus bên trong, Esc để đóng).
 * `locked`: đang gửi yêu cầu thì không cho đóng.
 */
export function Dialog({ open, title, children, actions, onClose, locked }: {
  open: boolean; title: string; children: ReactNode; actions: ReactNode; onClose: () => void; locked?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref} className="dialog" aria-labelledby={titleId}
      onCancel={e => { e.preventDefault(); if (!locked) onClose(); }}
      onClick={e => { if (e.target === ref.current && !locked) onClose(); }}
    >
      <h2 className="dialog__title" id={titleId}>{title}</h2>
      <div className="dialog__body">{children}</div>
      <div className="dialog__actions">{actions}</div>
    </dialog>
  );
}
