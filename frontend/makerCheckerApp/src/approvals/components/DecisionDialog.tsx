import type { ReactNode } from 'react';
import { code } from '@demo/shared/lib/format';
import { Cmd, Dialog } from '@demo/shared/ui';
import type { RequestDetail } from '../types';
import { outcomeAction } from './badges';

/**
 * Hộp thoại quyết định: Duyệt thì chỉ hỏi xác nhận, Từ chối thì bắt buộc ghi lý do.
 * `outcome` null là đang đóng.
 */
export function DecisionDialog({ outcome, request: r, comment, busy, onConfirm, onClose }: {
  outcome: { id: string; name: string } | null;
  request: RequestDetail;
  /** form ý kiến khi từ chối (rjsf); không có thì chỉ hỏi xác nhận */
  comment?: ReactNode;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const rejecting = outcome?.id === 'reject';
  const sender = r.initiator?.name ?? 'the requester';
  const action = outcome ? outcomeAction(outcome) : '';
  return (
    <Dialog
      open={outcome !== null}
      locked={busy}
      onClose={onClose}
      title={`${action} request`}
      actions={<>
        <Cmd icon="back" label="Cancel" disabled={busy} onClick={onClose} />
        <Cmd icon={rejecting ? 'reject' : 'approve'} label={action} primary danger={rejecting} busy={busy} onClick={onConfirm} />
      </>}
    >
      {rejecting ? (
        <>
          <p>Tell {sender} why request <b>{code(r.id)}</b> is being rejected.</p>
          {comment}
        </>
      ) : (
        <p>{action} request <b>{code(r.id)}</b> from {sender}? Once confirmed, it leaves the approval queue.</p>
      )}
    </Dialog>
  );
}
