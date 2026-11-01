import { asUser, http } from '@/shared/api/http';
import { EMPLOYEE } from '@/shared/config/actors';
import type { FormModel, FormValues } from '@/shared/form';

/** Một quy trình có form bắt đầu (một loại đơn). */
export type Process = { id: string; key: string; name: string };

const enc = encodeURIComponent;

/** Các API của màn lập đơn; gửi đơn với tư cách nhân viên. */
export const requestsApi = {
  processes: () => http.get<Process[]>('/processes').then(r => r.data),
  startForm: (processId: string) => http.get<FormModel>(`/processes/${enc(processId)}/start-form`).then(r => r.data),
  start: ({ processKey, values }: { processKey: string; values: FormValues }) =>
    http.post<{ id: string }>(`/processes/${enc(processKey)}/start`, { values }, asUser(EMPLOYEE)).then(r => r.data),
};
