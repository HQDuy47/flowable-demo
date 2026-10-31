import type { Status, UserRef } from './api';

const STATUS: Record<Status, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Đã rút',
  done: 'Hoàn tất',
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge badge-${status}`}>{STATUS[status]}</span>;
}

/** approve/reject → màu tương ứng, outcome khác → xám */
export function OutcomeBadge({ outcome }: { outcome: { id: string; name: string } }) {
  const tone = outcome.id === 'approve' ? 'approved' : outcome.id === 'reject' ? 'rejected' : 'done';
  return <span className={`badge badge-${tone}`}>{outcome.name}</span>;
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase();

export function Avatar({ user, size = 28 }: { user: UserRef; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden>
      {user ? initials(user.name) : '?'}
    </span>
  );
}

export function Person({ user }: { user: UserRef }) {
  if (!user) return <span className="muted">—</span>;
  return (
    <span className="person">
      <Avatar user={user} />
      <span>{user.name}</span>
    </span>
  );
}

// Icon nét mảnh 20×20 cho sidebar / nút
const ICONS = {
  list: 'M4 6h12M4 10h12M4 14h8',
  plus: 'M10 4v12M4 10h12',
  inbox: 'M3 11l2-6h10l2 6v4H3zM3 11h4l1 2h4l1-2h4',
  check: 'M4 10.5l4 4 8-9',
  logo: 'M5 3h7l3 3v11H5zM12 3v3h3M8 10h4M8 13h4',
};
export function Icon({ name, size = 18 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  );
}
