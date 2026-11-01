import { http } from '@/shared/api/http';

export type User = { id: string; name: string; title: string; role: 'employee' | 'approver' };

/** Tham chiếu rút gọn tới một người, dùng trong đơn và task. */
export type UserRef = { id: string; name: string; title: string } | null;

export const usersApi = {
  list: () => http.get<User[]>('/users').then(r => r.data),
};
