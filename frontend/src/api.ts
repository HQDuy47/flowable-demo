import type { FormModel } from './DynamicForm';

export type User = { id: string; name: string; title: string; role: 'employee' | 'approver' };
export type UserRef = { id: string; name: string; title: string } | null;
export type Status = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'done';
export type Outcome = { id: string; name: string } | null;

export type RequestSummary = {
  id: string; processName: string; initiator: UserRef;
  startTime: string; endTime: string | null; status: Status;
  currentTask: { id: string; name: string; assignee: UserRef } | null;
};
export type Step = {
  id: string; name: string; assignee: UserRef; startTime: string; endTime: string | null;
  cancelled: boolean; outcome: Outcome; notes: { label: string; value: unknown }[];
};
export type RequestDetail = RequestSummary & {
  fields: { id: string; label: string; type: string; value: unknown }[];
  steps: Step[];
};
export type TaskRow = {
  id: string; name: string; time: string; outcome?: Outcome;
  request: { id: string; processName: string; initiator: UserRef };
};

// Chưa có đăng nhập thật: mọi request gửi kèm id người dùng đang chọn
let currentUser = '';
export const setApiUser = (id: string) => { currentUser = id; };

async function j(url: string, init?: RequestInit) {
  const r = await fetch('/api' + url, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser },
  });
  if (!r.ok) throw new Error(await r.text());
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  users: (): Promise<User[]> => j('/users'),
  processes: (): Promise<{ id: string; key: string; name?: string }[]> => j('/processes'),
  startForm: (id: string): Promise<FormModel> => j(`/processes/${encodeURIComponent(id)}/start-form`),
  start: (key: string, values: object): Promise<{ id: string }> =>
    j(`/processes/${key}/start`, { method: 'POST', body: JSON.stringify({ values }) }),
  requests: (): Promise<RequestSummary[]> => j('/requests'),
  request: (id: string): Promise<RequestDetail> => j(`/requests/${id}`),
  cancel: (id: string) => j(`/requests/${id}/cancel`, { method: 'POST' }),
  tasks: (): Promise<TaskRow[]> => j('/tasks'),
  doneTasks: (): Promise<TaskRow[]> => j('/tasks/done'),
  taskForm: (id: string): Promise<FormModel> => j(`/tasks/${id}/form`),
  complete: (id: string, values: object, outcome?: string) =>
    j(`/tasks/${id}/complete`, { method: 'POST', body: JSON.stringify({ values, outcome }) }),
};
