import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestKeys } from '@/features/requests';
import { requestTypesApi } from './api';

export const requestTypeKeys = {
  all: ['request-types'] as const,
  list: () => [...requestTypeKeys.all, 'list'] as const,
  detail: (key: string) => [...requestTypeKeys.all, 'detail', key] as const,
};

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
      qc.invalidateQueries({ queryKey: requestKeys.processes() });
    },
  });
}
