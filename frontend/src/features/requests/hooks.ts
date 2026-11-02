import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approvalKeys } from '@/features/approvals';
import { requestsApi } from './api';

export const requestKeys = {
  all: ['requests'] as const,
  processes: () => [...requestKeys.all, 'processes'] as const,
  startForm: (processId: string) => [...requestKeys.all, 'start-form', processId] as const,
};

/** Các loại đơn đang triển khai trên Flowable. */
export function useProcesses() {
  return useQuery({ queryKey: requestKeys.processes(), queryFn: requestsApi.processes, staleTime: 5 * 60_000 });
}

/** Form bắt đầu của một loại đơn. Form gắn với bản triển khai nên không đổi, giữ trong cache. */
export function useStartForm(processId: string | undefined) {
  return useQuery({
    queryKey: requestKeys.startForm(processId ?? ''),
    queryFn: () => requestsApi.startForm(processId!),
    enabled: !!processId,
    staleTime: Infinity,
  });
}

/** Gửi đơn. Xong thì hàng chờ duyệt (và số đếm trên menu) được tải lại. */
export function useStartProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: requestsApi.start,
    // không return promise: callback của component chạy ngay, không đợi tải lại (task biến mất làm component bị gỡ, callback sẽ không chạy)
    onSuccess: () => { qc.invalidateQueries({ queryKey: approvalKeys.all }); },
  });
}
