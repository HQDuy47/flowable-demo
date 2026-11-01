/**
 * Người thao tác trong từng màn (chưa có đăng nhập thật, xem backend/src/users.ts):
 * lập đơn với tư cách nhân viên, duyệt đơn với tư cách trưởng phòng, thiết kế loại đơn với tư cách admin.
 * Id "manager" phải khớp flowable:assignee trong file BPMN.
 */
export const EMPLOYEE = 'an';
export const MANAGER = 'manager';
export const ADMIN = 'admin';
