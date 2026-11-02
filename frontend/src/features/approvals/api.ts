import { http } from '@/shared/api/http';
import type { FormModel, FormValues } from '@/shared/form';
import type { RequestDetail, Task } from './types';

const enc = encodeURIComponent;

/** Các API của màn duyệt. */
export const approvalsApi = {
  tasks: () => http.get<Task[]>('/tasks').then(r => r.data),
  taskForm: (taskId: string) => http.get<FormModel>(`/tasks/${enc(taskId)}/form`).then(r => r.data),
  request: (requestId: string) => http.get<RequestDetail>(`/requests/${enc(requestId)}`).then(r => r.data),
  complete: ({ taskId, values, outcome }: { taskId: string; values: FormValues; outcome?: string }) =>
    http.post<{ ok: true }>(`/tasks/${enc(taskId)}/complete`, { values, outcome }).then(r => r.data),
};
