import { QueryClient } from '@tanstack/react-query';

/**
 * Cấu hình chung cho React Query:
 * - dữ liệu coi là cũ ngay (staleTime 0) nên mở lại màn là tải lại, trừ khi hook tự đặt khác;
 * - lỗi thử lại 1 lần rồi hiện trạng thái lỗi kèm nút "Thử lại";
 * - mutation không tự thử lại (tránh gửi đơn / duyệt hai lần).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});
