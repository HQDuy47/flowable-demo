import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import type { AxiosRequestConfig } from 'axios';
import { flowableRequest } from '../common/flowable-http.js';
import { findUser, isSuperadmin, userRef } from '../common/users.js';
import { formKeyOf } from '../forms/form-definition.js';
import { FormSchemasService } from '../forms/form-schemas.service.js';
import { RequestTypesService } from '../request-types/request-types.service.js';
import { GENERIC_BPMN, GENERIC_PROCESS_KEY, TYPE_VARS } from './bpmn.js';
import type {
  FlowableTask,
  FlowableVariable,
  HistoricProcess,
  HistoricTask,
  Page,
  ProcessDefinition,
} from './flowable.types.js';

/** Form model lấy từ form engine của Flowable theo formKey. */
type FormModel = {
  fields: Array<{
    id: string;
    name: string;
    type: string;
    readOnly?: boolean | null;
  }>;
  outcomes?: Array<{ id: string; name: string }>;
};

export type RequestStatus =
  'pending' | 'approved' | 'rejected' | 'cancelled' | 'done';

/** Biến của process theo tên. Giá trị do người dùng nhập nên kiểu tuỳ form. */
type Vars = Record<string, any>;
const toMap = (vars?: FlowableVariable[]): Vars =>
  Object.fromEntries((vars ?? []).map((v) => [v.name, v.value]));

/** Người gửi đơn: biến "initiator" (backend ghi lúc gửi đơn). */
const sender = (vars: Vars) => userRef(vars.initiator);

/** Tên loại đơn lưu trong biến lúc gửi; đơn cũ (trước khi dùng quy trình chung) thì lấy tên process. */
const typeName = (vars: Vars, fallback?: string | null): string =>
  vars[TYPE_VARS.name] ?? fallback ?? 'Request';

/** Biến task-local lưu những gì người duyệt gửi ở bước đó → hiện lại trong lịch sử đơn. */
const SUBMISSION = '_submission';

/** Điều phối đơn trên Flowable (process API): gửi đơn, việc chờ duyệt, duyệt, lịch sử. */
@Injectable()
export class WorkflowService implements OnModuleInit {
  private readonly log = new Logger(WorkflowService.name);
  /** Promise deploy quy trình chung, dùng chung để chỉ deploy một lần. */
  private ready?: Promise<void>;

  constructor(
    private readonly http: HttpService,
    private readonly types: RequestTypesService,
    private readonly schemas: FormSchemasService,
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
        await this.call<Page<ProcessDefinition>>(
          'get',
          `/repository/process-definitions?key=${GENERIC_PROCESS_KEY}&latest=true`,
        )
      ).data[0];
      if (def) {
        const resource = encodeURIComponent(
          def.resource.split('/resources/').pop()!,
        );
        const xml = await this.call<string>(
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

  private call<T = unknown>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ) {
    return flowableRequest<T>(this.http, { method, url, data, ...config });
  }

  private getTask(taskId: string) {
    return this.call<FlowableTask>(
      'get',
      `/runtime/tasks/${encodeURIComponent(taskId)}`,
    );
  }

  // {a: 1, b: 2}  →  [{name:'a', value:1}, {name:'b', value:2}]  (định dạng Flowable cần)
  private toVariables(values: Record<string, unknown>): FlowableVariable[] {
    return Object.entries(values).map(([name, value]) => ({ name, value }));
  }

  /** Form lập đơn (trên Flowable) của đúng phiên bản loại đơn mà đơn này được gửi theo; null nếu không có. */
  private startFormOf(vars: Vars) {
    const key = vars[TYPE_VARS.key],
      version = Number(vars[TYPE_VARS.version]);
    return typeof key === 'string' && Number.isInteger(version)
      ? this.types.formByKey(formKeyOf(key, version, 'start'))
      : Promise.resolve(null);
  }

  private status(p: HistoricProcess, vars: Vars): RequestStatus {
    if (!p.endTime) return 'pending';
    if (p.deleteReason) return 'cancelled';
    if (vars.decision === 'approve') return 'approved';
    if (vars.decision === 'reject') return 'rejected';
    return 'done';
  }

  /** Một historic process instance → dòng "đơn" cho danh sách. */
  private summary(p: HistoricProcess, vars: Vars, currentTask?: HistoricTask) {
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
  private submissionOf(
    t: HistoricTask,
    form: FormModel | null,
    processVars: Vars,
  ) {
    const local = toMap(t.variables?.filter((v) => v.scope === 'local'));
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

  /**
   * Form lập đơn theo phiên bản mới nhất, ở dạng JSON Schema lưu theo formKey (cách 2). `key` là formKey:
   * renderer tự viết dùng nó để lấy form definition từ Flowable (cách 1).
   */
  async getStartForm(key: string) {
    const { form } = await this.types.latestStart(key);
    return {
      key: form.key,
      name: form.name,
      schema: form.schema,
      uiSchema: form.uiSchema,
    };
  }

  /**
   * Gửi đơn: kiểm tra theo JSON Schema rồi chạy quy trình chung, ghi kèm loại đơn + phiên bản để sau này dựng lại
   * đúng form. Phiên bản chỉ đọc một lần nên dữ liệu được kiểm tra và ghi theo cùng một phiên bản.
   */
  async startProcess(key: string, values: unknown, userId: string) {
    if (!findUser(userId))
      throw new BadRequestException(`User "${userId}" does not exist`);
    const { type, form } = await this.types.latestStart(key);
    const data = this.schemas.validate(form, values);
    await this.ensureProcess();
    const res = await this.call<{ id: string }>(
      'post',
      '/runtime/process-instances',
      {
        processDefinitionKey: GENERIC_PROCESS_KEY,
        variables: [
          ...this.toVariables(data),
          { name: 'initiator', value: userId },
          { name: TYPE_VARS.key, value: type.key },
          { name: TYPE_VARS.version, value: type.version },
          { name: TYPE_VARS.name, value: type.name },
        ],
      },
    );
    return { id: res.id };
  }

  /** Chi tiết đơn: thông tin đã điền (kèm nhãn từ form lúc gửi) + các bước duyệt. */
  async getRequest(id: string) {
    const [hist, tasks] = await Promise.all([
      this.call<Page<HistoricProcess>>(
        'post',
        '/query/historic-process-instances',
        {
          processInstanceId: id,
          includeProcessVariables: true,
        },
      ),
      this.call<Page<HistoricTask>>('post', '/query/historic-task-instances', {
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
    const start = await this.startFormOf(vars);

    // mỗi bước dùng form theo formKey của chính task đó
    const steps = await Promise.all(
      tasks.data.map(async (t) => ({
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
        tasks.data.find((t) => !t.endTime),
      ),
      fields: (start?.fields ?? []).map((f) => ({
        id: f.id,
        label: f.name,
        type: f.type,
        value: vars[f.id] ?? null,
      })),
      steps,
    };
  }

  /** Việc đang chờ user xử lý, kèm thông tin đơn. Superadmin thấy việc chờ của mọi người. */
  async listTasks(assignee: string) {
    const res = await this.call<Page<FlowableTask>>('post', '/query/tasks', {
      ...(isSuperadmin(assignee) ? {} : { assignee }),
      includeProcessVariables: true,
      sort: 'createTime',
      order: 'desc',
      size: 200,
    });
    return res.data.map((t) => {
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
    const res = await this.call<Page<HistoricTask>>(
      'post',
      '/query/historic-task-instances',
      {
        taskAssignee: assignee,
        finished: true,
        includeTaskLocalVariables: true,
        includeProcessVariables: true,
        sort: 'endTime',
        order: 'desc',
        size: 200,
      },
    );
    return Promise.all(
      res.data
        .filter((t) => !t.deleteReason)
        .map(async (t) => {
          const processVars = toMap(
            t.variables?.filter((v) => v.scope !== 'local'),
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

  /** JSON Schema của form gắn với task (theo formKey Flowable đã tính). Không có thì 404. */
  private async formOf(task: FlowableTask) {
    const form = await this.schemas.get(task.formKey);
    if (!form)
      throw new NotFoundException(
        `Form "${task.formKey ?? ''}" of task ${task.id} was not found`,
      );
    return form;
  }

  /**
   * Form duyệt theo formKey của task (Flowable đã tính sẵn, vd. "leaveRequest:1:approve"): JSON Schema đã lưu
   * theo formKey (cách 2) + kết quả chọn được + giá trị đơn. Renderer tự viết lấy form definition riêng qua formKey.
   */
  async getTaskForm(taskId: string) {
    const task = await this.getTask(taskId);
    const form = await this.formOf(task);
    const vars = toMap(
      await this.call<FlowableVariable[]>(
        'get',
        `/runtime/process-instances/${task.processInstanceId}/variables`,
      ),
    );
    // field id trùng tên biến → điền sẵn giá trị (các ô readOnly ở form duyệt)
    const formData = Object.fromEntries(
      Object.keys(form.schema.properties ?? {})
        .filter((id) => id in vars)
        .map((id) => [id, vars[id]]),
    );
    return {
      key: form.key,
      name: form.name,
      outcomes: form.outcomes,
      formData,
      schema: form.schema,
      uiSchema: form.uiSchema,
    };
  }

  /**
   * Duyệt: chỉ nhận các ô người duyệt được nhập trong form của task (vd. managerComment) và một kết quả có trong form,
   * nên không ghi đè được biến của đơn (requestTypeVersion, initiator…).
   */
  async completeTask(
    taskId: string,
    values: unknown,
    outcome: string | undefined,
    userId: string,
  ) {
    const task = await this.getTask(taskId);
    if (task.assignee !== userId && !isSuperadmin(userId))
      throw new ForbiddenException('This task is not assigned to you');
    const form = await this.formOf(task);
    // gateway rẽ nhánh theo "decision": kết quả lạ thì Flowable không tìm được nhánh nào
    if (form.outcomes.length && !form.outcomes.some((o) => o.id === outcome))
      throw new BadRequestException(
        `Choose one of: ${form.outcomes.map((o) => o.name).join(', ')}.`,
      );
    const data = this.schemas.validate(form, values);
    // Lưu riêng vào task (tên khác field form để không "che" biến process cùng tên)
    await this.call('post', `/runtime/tasks/${taskId}/variables`, [
      {
        name: SUBMISSION,
        type: 'string',
        scope: 'local',
        value: JSON.stringify({ values: data, outcome }),
      },
    ]);
    const variables = this.toVariables(data);
    if (outcome) variables.push({ name: 'decision', value: outcome }); // gateway đọc biến này
    // superadmin duyệt thay: chuyển task sang superadmin ngay trước khi hoàn thành để lịch sử ghi đúng người duyệt;
    // hoàn thành lỗi thì trả task lại cho người cũ, không để task kẹt ở superadmin
    const reassign = task.assignee !== userId;
    if (reassign) await this.call('put', `/runtime/tasks/${taskId}`, { assignee: userId });
    try {
      await this.call('post', `/runtime/tasks/${taskId}`, { action: 'complete', variables });
    } catch (e) {
      if (reassign)
        await this.call('put', `/runtime/tasks/${taskId}`, { assignee: task.assignee }).catch(() => undefined);
      throw e;
    }
    return { ok: true };
  }
}
