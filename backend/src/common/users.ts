/**
 * Người dùng demo. Đăng nhập qua POST /api/login (mật khẩu demo, chưa có token). Frontend gửi id qua header "x-user-id":
 * "maker" tạo đơn, "checker" duyệt đơn, "admin" thiết kế loại đơn. Id "checker" phải khớp flowable:assignee trong file BPMN.
 */
export interface User {
  id: string;
  name: string;
  title: string;
  role: 'employee' | 'approver' | 'admin';
}

// ponytail: mật khẩu demo dùng chung, backend vẫn tin header x-user-id; thêm JWT/session khi cần bảo mật thật
export const DEMO_PASSWORD = '123456';

export const USERS: User[] = [
  { id: 'maker', name: 'Nguyễn Văn An', title: 'Employee', role: 'employee' },
  { id: 'checker', name: 'Trần Minh Quân', title: 'Department manager', role: 'approver' },
  { id: 'admin', name: 'Lê Thu Hà', title: 'Administrator', role: 'admin' },
];

export const findUser = (id: unknown) => USERS.find((u) => u.id === id);

/** Thông tin rút gọn để hiển thị; id lạ (vd. dữ liệu cũ) vẫn trả về để không mất dấu. */
export const userRef = (id: unknown) => {
  if (typeof id !== 'string' || !id) return null;
  const u = findUser(id);
  return { id, name: u?.name ?? id, title: u?.title ?? '' };
};
