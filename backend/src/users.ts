/**
 * Người dùng demo (chưa có đăng nhập thật). Frontend gửi id qua header "x-user-id":
 * "an" tạo đơn, "manager" duyệt đơn, "admin" thiết kế loại đơn. Id "manager" phải khớp flowable:assignee trong file BPMN.
 */
export interface User {
  id: string;
  name: string;
  title: string;
  role: 'employee' | 'approver' | 'admin';
}

export const USERS: User[] = [
  { id: 'an', name: 'Nguyễn Văn An', title: 'Employee', role: 'employee' },
  { id: 'manager', name: 'Trần Minh Quân', title: 'Department manager', role: 'approver' },
  { id: 'admin', name: 'Lê Thu Hà', title: 'Administrator', role: 'admin' },
];

export const findUser = (id: unknown) => USERS.find((u) => u.id === id);

/** Thông tin rút gọn để hiển thị; id lạ (vd. dữ liệu cũ) vẫn trả về để không mất dấu. */
export const userRef = (id: unknown) => {
  if (typeof id !== 'string' || !id) return null;
  const u = findUser(id);
  return { id, name: u?.name ?? id, title: u?.title ?? '' };
};
