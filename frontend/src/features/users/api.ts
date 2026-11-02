import { http } from '@/shared/api/http';
import type { SessionUser } from '@/shared/auth/session';

export type User = SessionUser;

/** Tham chiếu rút gọn tới một người, dùng trong đơn và task. */
export type UserRef = { id: string; name: string; title: string } | null;

export const usersApi = {
  list: () => http.get<User[]>('/users').then(r => r.data),
  login: (body: { username: string; password: string }) => http.post<User>('/login', body).then(r => r.data),
};
