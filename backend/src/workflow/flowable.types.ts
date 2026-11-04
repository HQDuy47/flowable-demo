/**
 * Các trường dùng tới trong dữ liệu Flowable REST trả về (process API). Chỉ khai báo phần backend đọc,
 * Flowable còn trả nhiều trường khác.
 */

export type FlowableVariable = {
  name: string;
  value: unknown;
  /** "local" = biến của task, "global" = biến của process */
  scope?: 'local' | 'global';
};

/** Kết quả dạng danh sách có phân trang. */
export type Page<T> = { data: T[]; total: number };

/** POST /query/tasks, GET /runtime/tasks/:id */
export type FlowableTask = {
  id: string;
  name: string;
  assignee: string | null;
  /** Flowable tính từ biểu thức trong BPMN lúc tạo task, vd. "reqDonXinNghiPhep:2:approve" */
  formKey: string | null;
  processInstanceId: string;
  createTime: string;
  variables?: FlowableVariable[];
};

/** POST /query/historic-task-instances */
export type HistoricTask = Omit<FlowableTask, 'createTime'> & {
  startTime: string;
  endTime: string | null;
  /** có giá trị khi task bị huỷ (đơn bị rút), không phải được duyệt */
  deleteReason: string | null;
};

/** POST /query/historic-process-instances */
export type HistoricProcess = {
  id: string;
  processDefinitionName: string | null;
  startTime: string;
  endTime: string | null;
  deleteReason: string | null;
  variables?: FlowableVariable[];
};

/** GET /repository/process-definitions */
export type ProcessDefinition = {
  deploymentId: string;
  /** URL tới file BPMN, vd. ".../deployments/<id>/resources/requestApproval.bpmn20.xml" */
  resource: string;
};
