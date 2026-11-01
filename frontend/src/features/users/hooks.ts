import { useQuery } from '@tanstack/react-query';
import { usersApi } from './api';

export const userKeys = {
  all: ['users'] as const,
};

/** Danh sách người dùng demo; cố định trong backend nên không cần tải lại. */
export function useUsers() {
  return useQuery({ queryKey: userKeys.all, queryFn: usersApi.list, staleTime: Infinity });
}

/** Một người dùng theo id (vd. EMPLOYEE, MANAGER). */
export function useUser(id: string) {
  const users = useUsers();
  return { ...users, data: users.data?.find(u => u.id === id) };
}
