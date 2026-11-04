import { http } from '@demo/shared/api/http';
import type { SessionUser } from '@demo/shared/auth/session';

export type User = SessionUser;
export type { UserRef } from '@demo/shared/auth/session';

export const usersApi = {
  list: () => http.get<User[]>('/users').then(r => r.data),
  login: (body: { username: string; password: string }) => http.post<User>('/login', body).then(r => r.data),
};
