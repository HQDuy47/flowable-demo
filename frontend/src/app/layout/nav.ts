import type { Role } from '@/shared/auth/session';
import type { IconName } from '@/shared/ui';

/** Menu trái. Mỗi mục chỉ hiện với một vai trò: maker (employee), checker (approver), admin. */
export const NAV: { path: string; name: string; icon: IconName; role: Role }[] = [
  { path: '/new', name: 'New request', icon: 'add', role: 'employee' },
  { path: '/approvals', name: 'Approvals', icon: 'task', role: 'approver' },
  { path: '/request-types', name: 'Request types', icon: 'doc', role: 'admin' },
];

/** Mục menu ứng với đường dẫn hiện tại (vd. "/approvals/abc" → Approvals). */
export const navOf = (pathname: string) => NAV.find(n => pathname === n.path || pathname.startsWith(n.path + '/'));

/** Chữ trên thanh tab trình duyệt theo vai trò, để phân biệt tab maker / checker / admin. */
export const TAB_TITLE: Record<Role, string> = { employee: 'Maker', approver: 'Checker', admin: 'Admin' };

/** Màn đầu tiên của một vai trò. */
export const homeOf = (role: Role) => NAV.find(n => n.role === role)?.path ?? '/login';
