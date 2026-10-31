import { BadRequestException, ForbiddenException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { findUser, userRef } from './users.js';

/** Form trả về cho React — cùng hình dạng với form model của Flowable. */
export interface FormModel {
  key: string;
  name: string;
  fields: Array<{ id: string; name: string; type: string; value?: unknown; readOnly?: boolean; [k: string]: unknown }>;
  outcomes?: Array<{ id: string; name: string }>;
}

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'done';

type Vars = Record<string, any>;
const toMap = (vars?: Array<{ name: string; value: unknown }>): Vars =>
  Object.fromEntries((vars ?? []).map((v) => [v.name, v.value]));

/** Biến task-local lưu những gì người duyệt gửi ở bước đó → hiện lại trong lịch sử đơn. */
const SUBMISSION = '_submission';

@Injectable()
export class FlowableService {
  constructor(private readonly http: HttpService) {}

  /** Cache form theo deployment: "deploymentId/formKey" → form JSON. Deployment là bất biến nên cache an toàn. */
  private readonly formCache = new Map<string, FormModel>();
  /** Process definition cũng bất biến → cache theo id (kèm formKey của start event). */
  private readonly defCache = new Map<string, any>();

  private async call(method: 'get' | 'post' | 'delete', url: string, data?: any, config?: AxiosRequestConfig) {
    try {
      const res = await firstValueFrom(this.http.request({ method, url, data, ...config }));
      return res.data;
    } catch (e) {
      const err = e as AxiosError<any>;
      throw new HttpException(err.response?.data ?? err.message, err.response?.status ?? 500);
    }
  }

  // {a: 1, b: 2}  →  [{name:'a', value:1}, {name:'b', value:2}]  (định dạng Flowable cần)
  private toVariables(values: Record<string, any> = {}) {
    return Object.entries(values).map(([name, value]) => ({ name, value }));
  }

  /** Đọc nội dung thô một file trong deployment (không để axios tự parse). */
  private getResourceText(deploymentId: string, resourceName: string): Promise<string> {
    return this.call(
      'get',
      `/repository/deployments/${deploymentId}/resourcedata/${encodeURIComponent(resourceName)}`,
      undefined,
      { responseType: 'text', transformResponse: (d) => d },
    );
  }

  private async definition(id: string) {
    let def = this.defCache.get(id);
    if (!def) {
      def = await this.call('get', `/repository/process-definitions/${encodeURIComponent(id)}`);
      // REST không trả formKey của start event → đọc từ file BPMN
      const xml = await this.getResourceText(def.deploymentId, def.resource.split('/resources/').pop());
      def.startFormKey = /<startEvent\b[^>]*\bflowable:formKey="([^"]+)"/.exec(xml)?.[1];
      this.defCache.set(id, def);
    }
    return def;
  }

  /**
   * Image flowable-rest không có form engine, nên /start-form và /tasks/{id}/form không dùng được.
   * Thay vào đó: tìm file .form trong cùng deployment có "key" trùng formKey.
   */
  private async loadForm(deploymentId: string, formKey: string): Promise<FormModel> {
    const cacheKey = `${deploymentId}/${formKey}`;
    const cached = this.formCache.get(cacheKey);
    if (cached) return structuredClone(cached);

    const resources: Array<{ id: string }> = await this.call('get', `/repository/deployments/${deploymentId}/resources`);
    for (const r of resources.filter((r) => r.id.endsWith('.form'))) {
      const form = JSON.parse(await this.getResourceText(deploymentId, r.id)) as FormModel;
      this.formCache.set(`${deploymentId}/${form.key}`, form);
    }
    const form = this.formCache.get(cacheKey);
    if (!form) throw new NotFoundException(`Không tìm thấy form "${formKey}" trong deployment ${deploymentId}`);
    return structuredClone(form);
  }

  private status(p: any, vars: Vars): RequestStatus {
    if (!p.endTime) return 'pending';
    if (p.deleteReason) return 'cancelled';
    if (vars.decision === 'approve') return 'approved';
    if (vars.decision === 'reject') return 'rejected';
    return 'done';
  }

  /** Một historic process instance → dòng "đơn" cho danh sách. */
  private summary(p: any, currentTask?: any) {
    const vars = toMap(p.variables);
    return {
      id: p.id,
      processName: p.processDefinitionName,
      initiator: userRef(vars.initiator),
      startTime: p.startTime,
      endTime: p.endTime,
      status: this.status(p, vars),
      currentTask: currentTask
        ? { id: currentTask.id, name: currentTask.name, assignee: userRef(currentTask.assignee) }
        : null,
    };
  }

  /** Người duyệt đã gửi gì ở task này. Đơn cũ (chưa có biến _submission) → lấy tạm từ biến process. */
  private async submissionOf(t: any, deploymentId: string, processVars: Vars) {
    const local = toMap(t.variables?.filter((v: any) => v.scope === 'local'));
    const sub: { values: Vars; outcome?: string } =
      typeof local[SUBMISSION] === 'string'
        ? JSON.parse(local[SUBMISSION])
        : { values: processVars, outcome: processVars.decision };
    const form = t.formKey ? await this.loadForm(deploymentId, t.formKey) : null;
    return {
      outcome: sub.outcome ? (form?.outcomes?.find((o) => o.id === sub.outcome) ?? { id: sub.outcome, name: sub.outcome }) : null,
      notes: (form?.fields ?? [])
        .filter((f) => !f.readOnly && sub.values[f.id] != null && sub.values[f.id] !== '')
        .map((f) => ({ label: f.name, value: sub.values[f.id] })),
    };
  }

  /** Chỉ các quy trình có start form (bỏ quy trình mẫu sẵn trong image flowable-rest). */
  async listProcesses() {
    const res = await this.call('get', '/repository/process-definitions?latest=true&size=1000');
    const defs = await Promise.all(res.data.map((p: any) => this.definition(p.id)));
    return defs.filter((p) => p.startFormKey).map((p) => ({ id: p.id, key: p.key, name: p.name }));
  }

  async getStartForm(processDefinitionId: string) {
    const def = await this.definition(processDefinitionId);
    if (!def.startFormKey) throw new NotFoundException(`Quy trình ${def.key} không có start form`);
    return this.loadForm(def.deploymentId, def.startFormKey);
  }

  async startProcess(processKey: string, values: Record<string, any>, userId: string) {
    if (!findUser(userId)) throw new BadRequestException(`Người dùng "${userId}" không tồn tại`);
    const res = await this.call('post', '/runtime/process-instances', {
      processDefinitionKey: processKey,
      variables: [...this.toVariables(values), { name: 'initiator', value: userId }],
    });
    return { id: res.id };
  }

  /** Đơn do một người tạo (cả đang chạy lẫn đã xong). */
  async listRequests(initiator: string) {
    const [hist, active] = await Promise.all([
      this.call('post', '/query/historic-process-instances', {
        includeProcessVariables: true, sort: 'startTime', order: 'desc', size: 200,
        variables: [{ name: 'initiator', value: initiator, operation: 'equals', type: 'string' }],
      }),
      this.call('get', '/runtime/tasks?size=1000'),
    ]);
    const current = new Map(active.data.map((t: any) => [t.processInstanceId, t]));
    return hist.data.map((p: any) => this.summary(p, current.get(p.id)));
  }

  /** Chi tiết đơn: thông tin đã điền (kèm nhãn từ start form) + các bước duyệt. */
  async getRequest(id: string) {
    const [hist, tasks] = await Promise.all([
      this.call('post', '/query/historic-process-instances', { processInstanceId: id, includeProcessVariables: true }),
      this.call('post', '/query/historic-task-instances', {
        processInstanceId: id, includeTaskLocalVariables: true, sort: 'startTime', order: 'asc', size: 100,
      }),
    ]);
    const p = hist.data[0];
    if (!p) throw new NotFoundException(`Không tìm thấy đơn ${id}`);
    const vars = toMap(p.variables);
    const def = await this.definition(p.processDefinitionId);
    const startForm = def.startFormKey ? await this.loadForm(def.deploymentId, def.startFormKey) : null;

    const steps = await Promise.all(
      tasks.data.map(async (t: any) => ({
        id: t.id,
        name: t.name,
        assignee: userRef(t.assignee),
        startTime: t.startTime,
        endTime: t.endTime,
        cancelled: !!t.deleteReason,
        ...(t.endTime && !t.deleteReason ? await this.submissionOf(t, def.deploymentId, vars) : { outcome: null, notes: [] }),
      })),
    );

    return {
      ...this.summary(p, tasks.data.find((t: any) => !t.endTime)),
      fields: (startForm?.fields ?? []).map((f) => ({ id: f.id, label: f.name, type: f.type, value: vars[f.id] ?? null })),
      steps,
    };
  }

  /** Chỉ người tạo được rút đơn, và chỉ khi đơn còn đang chờ. */
  async cancelRequest(id: string, userId: string) {
    const vars = toMap(await this.call('get', `/runtime/process-instances/${encodeURIComponent(id)}/variables`));
    if (vars.initiator !== userId) throw new ForbiddenException('Chỉ người tạo đơn mới được rút đơn');
    await this.call('delete', `/runtime/process-instances/${encodeURIComponent(id)}?deleteReason=${encodeURIComponent('Người tạo rút đơn')}`);
    return { ok: true };
  }

  /** Việc đang chờ user xử lý, kèm thông tin đơn. */
  async listTasks(assignee: string) {
    const res = await this.call('post', '/query/tasks', {
      assignee, includeProcessVariables: true, sort: 'createTime', order: 'desc', size: 200,
    });
    return Promise.all(
      res.data.map(async (t: any) => ({
        id: t.id,
        name: t.name,
        time: t.createTime,
        request: {
          id: t.processInstanceId,
          processName: (await this.definition(t.processDefinitionId)).name,
          initiator: userRef(toMap(t.variables).initiator),
        },
      })),
    );
  }

  /** Việc user đã xử lý xong (bỏ qua task bị huỷ do người tạo rút đơn). */
  async listDoneTasks(assignee: string) {
    const res = await this.call('post', '/query/historic-task-instances', {
      taskAssignee: assignee, finished: true, includeTaskLocalVariables: true, includeProcessVariables: true,
      sort: 'endTime', order: 'desc', size: 200,
    });
    return Promise.all(
      res.data
        .filter((t: any) => !t.deleteReason)
        .map(async (t: any) => {
          const def = await this.definition(t.processDefinitionId);
          const processVars = toMap(t.variables?.filter((v: any) => v.scope !== 'local'));
          const { outcome } = await this.submissionOf(t, def.deploymentId, processVars);
          return {
            id: t.id,
            name: t.name,
            time: t.endTime,
            outcome,
            request: { id: t.processInstanceId, processName: def.name, initiator: userRef(processVars.initiator) },
          };
        }),
    );
  }

  async getTaskForm(taskId: string) {
    const task = await this.call('get', `/runtime/tasks/${encodeURIComponent(taskId)}`);
    if (!task.formKey) throw new NotFoundException(`Task ${taskId} không gắn form`);
    const def = await this.definition(task.processDefinitionId);
    const [form, vars] = await Promise.all([
      this.loadForm(def.deploymentId, task.formKey),
      this.call('get', `/runtime/process-instances/${task.processInstanceId}/variables`) as Promise<
        Array<{ name: string; value: unknown }>
      >,
    ]);
    // field id trùng tên biến → điền sẵn giá trị (vd. các ô readOnly ở form duyệt)
    const values = new Map(vars.map((v) => [v.name, v.value]));
    for (const f of form.fields) if (values.has(f.id)) f.value = values.get(f.id);
    return form;
  }

  async completeTask(taskId: string, values: Record<string, any>, outcome: string | undefined, userId: string) {
    const task = await this.call('get', `/runtime/tasks/${encodeURIComponent(taskId)}`);
    if (task.assignee !== userId) throw new ForbiddenException('Việc này không được giao cho bạn');
    // Lưu riêng vào task (tên khác field form để không "che" biến process cùng tên)
    await this.call('post', `/runtime/tasks/${taskId}/variables`, [
      { name: SUBMISSION, type: 'string', scope: 'local', value: JSON.stringify({ values, outcome }) },
    ]);
    const variables = this.toVariables(values);
    if (outcome) variables.push({ name: 'decision', value: outcome }); // gateway đọc biến này
    await this.call('post', `/runtime/tasks/${taskId}`, { action: 'complete', variables });
    return { ok: true };
  }
}
