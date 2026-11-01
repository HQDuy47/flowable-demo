import { Fields, type Field, type FormCtl } from '@/shared/form';
import { code } from '@/shared/lib/format';
import { Cmd, Dialog, MessageBar } from '@/shared/ui';
import type { RequestDetail } from '../types';
import { outcomeAction } from './badges';

/**
 * Hộp thoại quyết định: Duyệt thì chỉ hỏi xác nhận, Từ chối thì bắt buộc ghi lý do.
 * `outcome` null là đang đóng.
 */
export function DecisionDialog({ outcome, request: r, ctl, commentFields, busy, error, onConfirm, onClose }: {
  outcome: { id: string; name: string } | null;
  request: RequestDetail;
  ctl: FormCtl;
  commentFields: Field[];
  busy: boolean;
  error: string | null;
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
          {commentFields.length > 0 && <Fields ctl={ctl} fields={commentFields} />}
        </>
      ) : (
        <p>{action} request <b>{code(r.id)}</b> from {sender}? Once confirmed, it leaves the approval queue.</p>
      )}
      {error && <MessageBar intent="error"><b>The decision was not saved.</b> {error}</MessageBar>}
    </Dialog>
  );
}
