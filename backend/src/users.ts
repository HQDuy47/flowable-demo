/**
 * Người dùng demo (chưa có đăng nhập thật). Frontend gửi id qua header "x-user-id".
 * Id "manager" phải khớp flowable:assignee trong file BPMN.
 */
export interface User {
  id: string;
  name: string;
  title: string;
  role: 'employee' | 'approver';
}

export const USERS: User[] = [
  { id: 'an', name: 'Nguyễn Văn An', title: 'Nhân viên', role: 'employee' },
  { id: 'manager', name: 'Trần Minh Quân', title: 'Trưởng phòng', role: 'approver' },
];

export const findUser = (id: unknown) => USERS.find((u) => u.id === id);

/** Thông tin rút gọn để hiển thị; id lạ (vd. dữ liệu cũ) vẫn trả về để không mất dấu. */
export const userRef = (id: unknown) => {
  if (typeof id !== 'string' || !id) return null;
  const u = findUser(id);
  return { id, name: u?.name ?? id, title: u?.title ?? '' };
};
