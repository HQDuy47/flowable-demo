import type { Outcome, Status } from '../types';

export const STATUS_LABEL: Record<Status, string> = {
  pending: 'Pending approval', approved: 'Approved', rejected: 'Rejected', cancelled: 'Withdrawn', done: 'Completed',
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABEL[status]}</span>;
}

/** Nhãn tiếng Anh cho kết quả theo id; kết quả lạ giữ tên trong form của Flowable. */
const ACTION_LABEL: Record<string, string> = { approve: 'Approve', reject: 'Reject' };
const RESULT_LABEL: Record<string, string> = { approve: 'Approved', reject: 'Rejected' };

/** Tên nút cho một kết quả (Approve, Reject). */
export const outcomeAction = (o: { id: string; name: string }) => ACTION_LABEL[o.id] ?? o.name;

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  if (!outcome) return null;
  return <span className={`badge badge--${outcome.id === 'approve' ? 'approved' : 'rejected'}`}>{RESULT_LABEL[outcome.id] ?? outcome.name}</span>;
}
