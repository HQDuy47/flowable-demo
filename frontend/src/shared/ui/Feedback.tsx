import type { ReactNode } from 'react';
import { Ic, type IconName } from './icons';

/** Thanh thông báo: thành công, lỗi, cảnh báo, thông tin. */
export function MessageBar({ intent, children, onDismiss }: {
  intent: 'info' | 'success' | 'error' | 'warning'; children: ReactNode; onDismiss?: () => void;
}) {
  const icon: IconName = intent === 'success' ? 'success' : intent === 'info' ? 'info' : 'error';
  return (
    <div className={`mbar mbar--${intent}`} role={intent === 'error' ? 'alert' : 'status'}>
      <Ic name={icon} />
      <div className="mbar__text">{children}</div>
      {onDismiss && <button type="button" className="mbar__close" onClick={onDismiss} aria-label="Dismiss">✕</button>}
    </div>
  );
}

/** Trạng thái lỗi khi tải dữ liệu, kèm nút thử lại. */
export function Problem({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <MessageBar intent="error">
      <b>Could not load data.</b> {message} Check that the backend (port 3000) and Flowable are running.
      {onRetry && <> <button type="button" className="link" onClick={onRetry}>Retry</button></>}
    </MessageBar>
  );
}

/** Trạng thái trống: nói rõ cái gì trống và làm gì tiếp. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children}
    </div>
  );
}

/** Khung chờ có hình dạng của nội dung sắp tải. */
export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <span key={i} />)}
    </div>
  );
}
