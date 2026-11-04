import type { UserRef } from '@demo/shared/auth/session';

export type Status = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'done';
export type Outcome = { id: string; name: string } | null;

/** Việc đang chờ trưởng phòng duyệt. */
export type Task = {
  id: string;
  name: string;
  time: string;
  request: { id: string; processName: string; initiator: UserRef };
};

/** Một bước xử lý của đơn (một user task trong Flowable). */
export type Step = {
  id: string;
  name: string;
  assignee: UserRef;
  startTime: string;
  endTime: string | null;
  cancelled: boolean;
  outcome: Outcome;
  notes: { label: string; value: unknown }[];
};

/** Chi tiết một đơn: thông tin đã điền và các bước đã qua. */
export type RequestDetail = {
  id: string;
  processName: string;
  initiator: UserRef;
  startTime: string;
  endTime: string | null;
  status: Status;
  currentTask: { id: string; name: string; assignee: UserRef } | null;
  fields: { id: string; label: string; type: string; value: unknown }[];
  steps: Step[];
};
