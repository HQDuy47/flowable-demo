import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError, AxiosRequestConfig } from 'axios';
import { findUser, userRef } from './users.js';
import { RequestTypesService } from './request-types.service.js';
import {
  GENERIC_BPMN,
  GENERIC_PROCESS_KEY,
  startForm,
  toJsonSchema,
  TYPE_VARS,
  type TypeVersion,
} from './request-types.js';

/** Form trả về cho React — cùng hình dạng với form model của Flowable. */
export interface FormModel {
  key: string;
  name: string;
  fields: Array<{
    id: string;
    name: string;
    type: string;
    value?: unknown;
    readOnly?: boolean;
    [k: string]: unknown;
  }>;
  outcomes?: Array<{ id: string; name: string }>;
}

export type RequestStatus =
  'pending' | 'approved' | 'rejected' | 'cancelled' | 'done';

type Vars = Record<string, any>;
const toMap = (vars?: Array<{ name: string; value: unknown }>): Vars =>
  Object.fromEntries((vars ?? []).map((v) => [v.name, v.value]));

/** Người gửi đơn: biến "initiator"; đơn không có biến này thì lấy họ tên điền trong form. */
const sender = (vars: Vars) =>
  userRef(vars.initiator) ??
  (typeof vars.employeeName === 'string' && vars.employeeName
    ? { id: '', name: vars.employeeName, title: '' }
    : null);

/** Tên loại đơn lưu trong biến lúc gửi; đơn cũ (trước khi dùng quy trình chung) thì lấy tên process. */
const typeName = (vars: Vars, fallback?: string) =>
  vars[TYPE_VARS.name] ?? fallback ?? 'Request';

/** Biến task-local lưu những gì người duyệt gửi ở bước đó → hiện lại trong lịch sử đơn. */
const SUBMISSION = '_submission';

@Injectable()
export class FlowableService implements OnModuleInit {
  private readonly log = new Logger(FlowableService.name);
  /** Promise deploy quy trình chung, dùng chung để chỉ deploy một lần. */
  private ready?: Promise<void>;

  constructor(
    private readonly http: HttpService,
    private readonly types: RequestTypesService,
  ) {}

  async onModuleInit() {
    // Flowable chưa chạy thì bỏ qua, lần gửi đơn đầu tiên sẽ thử lại
    await this.ensureProcess().catch((e) =>
      this.log.warn(
        `Could not deploy ${GENERIC_PROCESS_KEY}: ${(e as Error).message}`,
      ),
    );
  }

  /** Deploy quy trình chung nếu Flowable chưa có, hoặc bản đang chạy khác GENERIC_BPMN (vừa sửa BPMN trong code). */
  private ensureProcess() {
    this.ready ??= (async () => {
      const def = (
        await this.call(
          'get',
          `/repository/process-definitions?key=${GENERIC_PROCESS_KEY}&latest=true`,
        )
      ).data[0];
      if (def) {
        const resource = encodeURIComponent(
          def.resource.split('/resources/').pop(),
        );
        const xml = await this.call(
          'get',
          `/repository/deployments/${def.deploymentId}/resourcedata/${resource}`,
          undefined,
          {
            responseType: 'text',
            transformResponse: (d) => d,
          },
        );
        if (xml === GENERIC_BPMN) return;
      }
      const body = new FormData();
      body.append(
        'file',
        new Blob([GENERIC_BPMN], { type: 'text/xml' }),
        `${GENERIC_PROCESS_KEY}.bpmn20.xml`,
      );
      await this.call('post', '/repository/deployments', body);
      this.log.log(`Deployed ${GENERIC_PROCESS_KEY}`);
    })().catch((e) => {
      this.ready = undefined; // lỗi thì lần sau thử lại
      throw e;
    });
    return this.ready;
  }

  private async call(
    method: 'get' | 'post' | 'delete',
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ) {
    try {
      const res = await firstValueFrom(
        this.http.request({ method, url, data, ...config }),
      );
      return res.data;
    } catch (e) {
      const err = e as AxiosError<any>;
      throw new HttpException(
        err.response?.data ?? err.message,
        err.response?.status ?? 500,
      );
    }
  }

  // {a: 1, b: 2}  →  [{name:'a', value:1}, {name:'b', value:2}]  (định dạng Flowable cần)
  private toVariables(values: Record<string, any> = {}) {
    return Object.entries(values).map(([name, value]) => ({ name, value }));
  }

  /** Phiên bản loại đơn mà đơn này được gửi theo (null nếu là đơn cũ hoặc loại đơn đã mất). */
  private typeVersionOf(vars: Vars): Promise<TypeVersion | null> {
    return this.types.version(vars[TYPE_VARS.key], vars[TYPE_VARS.version]);
  }

  private status(p: any, vars: Vars): RequestStatus {
    if (!p.endTime) return 'pending';
    if (p.deleteReason) return 'cancelled';
    if (vars.decision === 'approve') return 'approved';
    if (vars.decision === 'reject') return 'rejected';
    return 'done';
  }

  /** Một historic process instance → dòng "đơn" cho danh sách. */
  private summary(p: any, vars: Vars, currentTask?: any) {
    return {
      id: p.id,
      processName: typeName(vars, p.processDefinitionName),
      initiator: sender(vars),
      startTime: p.startTime,
      endTime: p.endTime,
      status: this.status(p, vars),
      currentTask: currentTask
        ? {
            id: currentTask.id,
            name: currentTask.name,
            assignee: userRef(currentTask.assignee),
          }
        : null,
    };
  }

  /** Người duyệt đã gửi gì ở task này. Đơn cũ (chưa có biến _submission) → lấy tạm từ biến process. */
  private submissionOf(t: any, form: FormModel | null, processVars: Vars) {
    const local = toMap(t.variables?.filter((v: any) => v.scope === 'local'));
    const sub: { values: Vars; outcome?: string } =
      typeof local[SUBMISSION] === 'string'
        ? JSON.parse(local[SUBMISSION])
        : { values: processVars, outcome: processVars.decision };
    return {
      outcome: sub.outcome
        ? (form?.outcomes?.find((o) => o.id === sub.outcome) ?? {
            id: sub.outcome,
            name: sub.outcome,
          })
        : null,
      notes: (form?.fields ?? [])
        .filter(
          (f) =>
            !f.readOnly && sub.values[f.id] != null && sub.values[f.id] !== '',
        )
        .map((f) => ({ label: f.name, value: sub.values[f.id] })),
    };
  }

  /** Các loại đơn để lập (id = key loại đơn). */
  async listProcesses() {
    const types = await this.types.list();
    return types
      .map((t) => ({ id: t.key, key: t.key, name: t.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }

  /** Form lập đơn theo phiên bản mới nhất của loại đơn. */
  async getStartForm(key: string) {
    const rt = await this.types.get(key);
    const form = startForm(rt.key, rt.versions.at(-1)!);
    return { key: form.key, name: form.name, ...toJsonSchema(form) };
  }

  /** Gửi đơn: chạy quy trình chung, ghi kèm loại đơn + phiên bản để sau này dựng lại đúng form. */
  async startProcess(key: string, values: Record<string, any>, userId: string) {
    if (!findUser(userId))
      throw new BadRequestException(`User "${userId}" does not exist`);
    const rt = await this.types.get(key);
    await this.ensureProcess();
    const res = await this.call('post', '/runtime/process-instances', {
      processDefinitionKey: GENERIC_PROCESS_KEY,
      variables: [
        ...this.toVariables(values),
        { name: 'initiator', value: userId },
        { name: TYPE_VARS.key, value: rt.key },
        { name: TYPE_VARS.version, value: rt.version },
        { name: TYPE_VARS.name, value: rt.name },
      ],
    });
    return { id: res.id };
  }

  /** Chi tiết đơn: thông tin đã điền (kèm nhãn từ form lúc gửi) + các bước duyệt. */
  async getRequest(id: string) {
    const [hist, tasks] = await Promise.all([
      this.call('post', '/query/historic-process-instances', {
        processInstanceId: id,
        includeProcessVariables: true,
      }),
      this.call('post', '/query/historic-task-instances', {
        processInstanceId: id,
        includeTaskLocalVariables: true,
        sort: 'startTime',
        order: 'asc',
        size: 100,
      }),
    ]);
    const p = hist.data[0];
    if (!p) throw new NotFoundException(`Request ${id} was not found`);
    const vars = toMap(p.variables);
    const tv = await this.typeVersionOf(vars);

    // mỗi bước dùng form theo formKey của chính task đó
    const steps = await Promise.all(
      tasks.data.map(async (t: any) => ({
        id: t.id,
        name: t.name,
        assignee: userRef(t.assignee),
        startTime: t.startTime,
        endTime: t.endTime,
        cancelled: !!t.deleteReason,
        ...(t.endTime && !t.deleteReason
          ? this.submissionOf(t, await this.types.formByKey(t.formKey), vars)
          : { outcome: null, notes: [] }),
      })),
    );

    return {
      ...this.summary(
        p,
        vars,
        tasks.data.find((t: any) => !t.endTime),
      ),
      fields: (tv?.fields ?? []).map((f) => ({
        id: f.id,
        label: f.name,
        type: f.type,
        value: vars[f.id] ?? null,
      })),
      steps,
    };
  }

  /** Việc đang chờ user xử lý, kèm thông tin đơn. */
  async listTasks(assignee: string) {
    const res = await this.call('post', '/query/tasks', {
      assignee,
      includeProcessVariables: true,
      sort: 'createTime',
      order: 'desc',
      size: 200,
    });
    return res.data.map((t: any) => {
      const vars = toMap(t.variables);
      return {
        id: t.id,
        name: t.name,
        time: t.createTime,
        request: {
          id: t.processInstanceId,
          processName: typeName(vars),
          initiator: sender(vars),
        },
      };
    });
  }

  /** Việc user đã xử lý xong (bỏ qua task bị huỷ do người tạo rút đơn). */
  async listDoneTasks(assignee: string) {
    const res = await this.call('post', '/query/historic-task-instances', {
      taskAssignee: assignee,
      finished: true,
      includeTaskLocalVariables: true,
      includeProcessVariables: true,
      sort: 'endTime',
      order: 'desc',
      size: 200,
    });
    return Promise.all(
      res.data
        .filter((t: any) => !t.deleteReason)
        .map(async (t: any) => {
          const processVars = toMap(
            t.variables?.filter((v: any) => v.scope !== 'local'),
          );
          const { outcome } = this.submissionOf(
            t,
            await this.types.formByKey(t.formKey),
            processVars,
          );
          return {
            id: t.id,
            name: t.name,
            time: t.endTime,
            outcome,
            request: {
              id: t.processInstanceId,
              processName: typeName(processVars),
              initiator: sender(processVars),
            },
          };
        }),
    );
  }

  /** Form duyệt tra theo formKey của task (Flowable đã tính sẵn, vd. "leaveRequest:1:approve"), điền sẵn giá trị đơn. */
  async getTaskForm(taskId: string) {
    const task = await this.call(
      'get',
      `/runtime/tasks/${encodeURIComponent(taskId)}`,
    );
    const form: FormModel | null = await this.types.formByKey(task.formKey);
    if (!form)
      throw new NotFoundException(
        `Form "${task.formKey ?? ''}" of task ${taskId} was not found`,
      );
    const vars = toMap(
      await this.call(
        'get',
        `/runtime/process-instances/${task.processInstanceId}/variables`,
      ),
    );
    // field id trùng tên biến → điền sẵn giá trị (các ô readOnly ở form duyệt)
    const formData = Object.fromEntries(form.fields.filter((f) => f.id in vars).map((f) => [f.id, vars[f.id]]));
    return { key: form.key, name: form.name, outcomes: form.outcomes ?? [], formData, ...toJsonSchema(form) };
  }

  async completeTask(
    taskId: string,
    values: Record<string, any>,
    outcome: string | undefined,
    userId: string,
  ) {
    const task = await this.call(
      'get',
      `/runtime/tasks/${encodeURIComponent(taskId)}`,
    );
    if (task.assignee !== userId)
      throw new ForbiddenException('This task is not assigned to you');
    // Lưu riêng vào task (tên khác field form để không "che" biến process cùng tên)
    await this.call('post', `/runtime/tasks/${taskId}/variables`, [
      {
        name: SUBMISSION,
        type: 'string',
        scope: 'local',
        value: JSON.stringify({ values, outcome }),
      },
    ]);
    const variables = this.toVariables(values);
    if (outcome) variables.push({ name: 'decision', value: outcome }); // gateway đọc biến này
    await this.call('post', `/runtime/tasks/${taskId}`, {
      action: 'complete',
      variables,
    });
    return { ok: true };
  }
}
