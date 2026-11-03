import { Body, Controller, Get, Headers, NotFoundException, Param, Post, UnauthorizedException } from '@nestjs/common';
import { FlowableService } from './flowable.service.js';
import { RequestTypesService } from './request-types.service.js';
import { toJsonSchema } from './request-types.js';
import { DEMO_PASSWORD, findUser, USERS } from './users.js';

/** Đăng nhập demo qua POST /api/login; sau đó người dùng hiện tại lấy từ header "x-user-id" do frontend gửi. */
@Controller('api')
export class WorkflowController {
  constructor(
    private readonly flowable: FlowableService,
    private readonly types: RequestTypesService,
  ) {}

  @Get('users')
  listUsers() { return USERS; }

  /** Đúng id + mật khẩu demo thì trả về người dùng (kèm role để frontend lọc menu). */
  @Post('login')
  login(@Body() body: { username?: string; password?: string }) {
    const user = findUser(body?.username?.trim().toLowerCase());
    if (!user || body.password !== DEMO_PASSWORD) throw new UnauthorizedException('Incorrect username or password');
    return user;
  }

  @Get('processes')
  listProcesses() { return this.flowable.listProcesses(); }

  @Get('processes/:id/start-form')
  getStartForm(@Param('id') id: string) { return this.flowable.getStartForm(id); }

  @Post('processes/:key/start')
  async start(@Param('key') key: string, @Body() body: { values: Record<string, any> }, @Headers('x-user-id') user: string) {
    // kiểm tra lại theo JSON Schema (bắt buộc, kiểu, rule) — không tin dữ liệu từ trình duyệt
    const values = await this.types.checkStartValues(key, body?.values);
    return this.flowable.startProcess(key, values, user);
  }

  @Get('requests/:id')
  getRequest(@Param('id') id: string) { return this.flowable.getRequest(id); }

  /** Việc đang chờ user hiện tại duyệt */
  @Get('tasks')
  listTasks(@Headers('x-user-id') user: string) { return this.flowable.listTasks(user); }

  /** Việc user hiện tại đã duyệt xong */
  @Get('tasks/done')
  listDoneTasks(@Headers('x-user-id') user: string) { return this.flowable.listDoneTasks(user); }

  @Get('tasks/:id/form')
  getTaskForm(@Param('id') id: string) { return this.flowable.getTaskForm(id); }

  /** Form theo formKey (vd. "leaveRequest:1:start") ở dạng JSON Schema + uiSchema, cho react-jsonschema-form. */
  @Get('forms/:formKey/json-schema')
  async getFormSchema(@Param('formKey') formKey: string) {
    const form = await this.types.formByKey(formKey);
    if (!form) throw new NotFoundException(`Form "${formKey}" was not found`);
    return toJsonSchema(form);
  }

  @Post('tasks/:id/complete')
  complete(
    @Param('id') id: string,
    @Body() body: { values: Record<string, any>; outcome?: string },
    @Headers('x-user-id') user: string,
  ) {
    return this.flowable.completeTask(id, body.values, body.outcome, user);
  }
}
