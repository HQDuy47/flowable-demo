import axios, { AxiosError } from 'axios';

/**
 * HTTP client dùng chung. Mọi lời gọi đi qua proxy "/api" của Vite tới backend NestJS.
 * Lỗi từ server được đổi thành `Error` có thông điệp đọc được, để UI chỉ cần hiện `error.message`.
 */
export const http = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.response.use(
  res => res,
  (err: AxiosError<{ message?: unknown }>) => {
    const data = err.response?.data;
    let message: string;
    if (data && typeof data === 'object' && 'message' in data) {
      message = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
    } else if (typeof data === 'string' && data) {
      message = data;
    } else if (err.response) {
      message = `The server returned error ${err.response.status}.`;
    } else {
      message = 'Could not reach the server.';
    }
    return Promise.reject(new Error(message));
  },
);

/** Backend lấy người dùng hiện tại từ header "x-user-id" (chưa có đăng nhập thật). */
export const asUser = (userId: string) => ({ headers: { 'x-user-id': userId } });
