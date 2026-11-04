import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestTypesApi, type RequestTypeInput } from './api';

/**
 * Query key của màn New request (nằm ở app khác). Micro frontend không import code của nhau:
 * hai bên chỉ thống nhất key này và dùng chung một QueryClient của shell.
 */
const REQUESTS_KEY = ['requests'] as const;

export const requestTypeKeys = {
  all: ['request-types'] as const,
  list: () => [...requestTypeKeys.all, 'list'] as const,
  detail: (key: string) => [...requestTypeKeys.all, 'detail', key] as const,
  preview: (input: RequestTypeInput) => [...requestTypeKeys.all, 'preview', input] as const,
};

/** Form xem trước của bản thiết kế. Đang gõ thì giữ form cũ trên màn đến khi có form mới. */
export function usePreviewForm(input: RequestTypeInput) {
  return useQuery({
    queryKey: requestTypeKeys.preview(input),
    queryFn: () => requestTypesApi.preview(input),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
    retry: false, // 400 là bản thiết kế chưa hợp lệ, thử lại không đổi được
  });
}

export function useRequestTypes(enabled = true) {
  return useQuery({ queryKey: requestTypeKeys.list(), queryFn: requestTypesApi.list, enabled });
}

export function useRequestType(key: string | undefined) {
  return useQuery({ queryKey: requestTypeKeys.detail(key ?? ''), queryFn: () => requestTypesApi.get(key!), enabled: !!key });
}

/** Lưu (tạo mới hoặc phiên bản mới). Xong thì danh sách loại đơn ở màn New request được tải lại. */
export function useSaveRequestType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, input }: { key?: string; input: Parameters<typeof requestTypesApi.create>[0] }) =>
      key ? requestTypesApi.update({ key, input }) : requestTypesApi.create(input),
    onSuccess: saved => {
      qc.setQueryData(requestTypeKeys.detail(saved.key), saved);
      qc.invalidateQueries({ queryKey: requestTypeKeys.list() });
      qc.invalidateQueries({ queryKey: REQUESTS_KEY }); // danh sách loại đơn + form lập đơn đã cache
    },
  });
}
