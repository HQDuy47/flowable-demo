import { ADMIN, EMPLOYEE, MANAGER } from '@/shared/config/actors';
import type { IconName } from '@/shared/ui';

/** Menu trái. Mỗi mục gắn với người thao tác trong màn đó. */
export const NAV: { path: string; name: string; icon: IconName; actor: string }[] = [
  { path: '/new', name: 'New request', icon: 'add', actor: EMPLOYEE },
  { path: '/approvals', name: 'Approvals', icon: 'task', actor: MANAGER },
  { path: '/request-types', name: 'Request types', icon: 'doc', actor: ADMIN },
];

/** Mục menu ứng với đường dẫn hiện tại (vd. "/approvals/abc" → Approvals). */
export const navOf = (pathname: string) => NAV.find(n => pathname === n.path || pathname.startsWith(n.path + '/'));
