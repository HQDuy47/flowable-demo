import { http } from '@demo/shared/api/http';
import type { FormValues, SchemaFormDef } from '@demo/shared/form';
import type { RequestDetail, Task } from './types';

const enc = encodeURIComponent;

/** Form duyệt: JSON Schema (các ô của đơn chỉ đọc + ô ý kiến), giá trị đơn, các kết quả chọn được. */
export type TaskForm = SchemaFormDef & { outcomes: { id: string; name: string }[]; formData: FormValues };

/** Các API của màn duyệt. */
export const approvalsApi = {
  tasks: () => http.get<Task[]>('/tasks').then(r => r.data),
  taskForm: (taskId: string) => http.get<TaskForm>(`/tasks/${enc(taskId)}/form`).then(r => r.data),
  request: (requestId: string) => http.get<RequestDetail>(`/requests/${enc(requestId)}`).then(r => r.data),
  complete: ({ taskId, values, outcome }: { taskId: string; values: FormValues; outcome?: string }) =>
    http.post<{ ok: true }>(`/tasks/${enc(taskId)}/complete`, { values, outcome }).then(r => r.data),
};
