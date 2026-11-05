import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approvalsApi } from './api';

export const approvalKeys = {
  all: ['approvals'] as const,
  tasks: () => [...approvalKeys.all, 'tasks'] as const,
  taskForm: (taskId: string) => [...approvalKeys.all, 'task-form', taskId] as const,
  request: (requestId: string) => [...approvalKeys.all, 'request', requestId] as const,
};

/** Hàng chờ duyệt của người đăng nhập. Tải lại mỗi khi màn được mở hoặc cửa sổ được focus lại. */
export function useTasks(enabled = true) {
  return useQuery({ queryKey: approvalKeys.tasks(), queryFn: approvalsApi.tasks, enabled });
}

export function useTaskForm(taskId: string | undefined) {
  return useQuery({
    queryKey: approvalKeys.taskForm(taskId ?? ''),
    queryFn: () => approvalsApi.taskForm(taskId!),
    enabled: !!taskId,
  });
}

export function useRequestDetail(requestId: string | undefined) {
  return useQuery({
    queryKey: approvalKeys.request(requestId ?? ''),
    queryFn: () => approvalsApi.request(requestId!),
    enabled: !!requestId,
  });
}

/** Lưu quyết định (duyệt / từ chối). Xong thì làm mới mọi dữ liệu của màn duyệt. */
export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approvalsApi.complete,
    // không return promise: callback của component chạy ngay, không đợi tải lại (task biến mất làm component bị gỡ, callback sẽ không chạy)
    onSuccess: () => { qc.invalidateQueries({ queryKey: approvalKeys.all }); },
  });
}
