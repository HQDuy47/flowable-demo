/** Người dùng đã đăng nhập, lưu trong sessionStorage: mỗi tab một phiên riêng (tab maker, tab checker), F5 không mất. */
export type Role = 'employee' | 'approver' | 'admin';
export type SessionUser = { id: string; name: string; title: string; role: Role };

const KEY = 'session-user';

export function getSession(): SessionUser | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function setSession(user: SessionUser | null) {
  try {
    if (user) sessionStorage.setItem(KEY, JSON.stringify(user));
    else sessionStorage.removeItem(KEY);
  } catch {
    // trình duyệt chặn storage: phiên chỉ còn đến khi tải lại trang
  }
}
