import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { setSession } from '@demo/shared/auth/session';
import { usersApi } from './api';

export const userKeys = {
  all: ['users'] as const,
};

/** Danh sách người dùng demo; cố định trong backend nên không cần tải lại. */
export function useUsers() {
  return useQuery({ queryKey: userKeys.all, queryFn: usersApi.list, staleTime: Infinity });
}

/** Đăng nhập: lưu phiên và xoá cache của người trước (dữ liệu phụ thuộc người dùng). */
export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.login,
    onSuccess: user => { qc.clear(); setSession(user); },
  });
}

/** Đăng xuất: xoá phiên và cache. */
export function useLogout() {
  const qc = useQueryClient();
  return () => { setSession(null); qc.clear(); };
}

/** Một người dùng theo id (vd. người đang đăng nhập). */
export function useUser(id: string) {
  const users = useUsers();
  return { ...users, data: users.data?.find(u => u.id === id) };
}
