import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { FlowableService } from './flowable.service.js';
import { USERS } from './users.js';

/** Chưa có đăng nhập: người dùng hiện tại lấy từ header "x-user-id" do frontend gửi. */
@Controller('api')
export class WorkflowController {
  constructor(private readonly flowable: FlowableService) {}

  @Get('users')
  listUsers() { return USERS; }

  @Get('processes')
  listProcesses() { return this.flowable.listProcesses(); }

  @Get('processes/:id/start-form')
  getStartForm(@Param('id') id: string) { return this.flowable.getStartForm(id); }

  @Post('processes/:key/start')
  start(@Param('key') key: string, @Body() body: { values: Record<string, any> }, @Headers('x-user-id') user: string) {
    return this.flowable.startProcess(key, body.values, user);
  }

  /** Đơn do user hiện tại tạo */
  @Get('requests')
  listRequests(@Headers('x-user-id') user: string) { return this.flowable.listRequests(user); }

  @Get('requests/:id')
  getRequest(@Param('id') id: string) { return this.flowable.getRequest(id); }

  @Post('requests/:id/cancel')
  cancel(@Param('id') id: string, @Headers('x-user-id') user: string) {
    return this.flowable.cancelRequest(id, user);
  }

  @Get('tasks')
  listTasks(@Headers('x-user-id') user: string) { return this.flowable.listTasks(user); }

  @Get('tasks/done')
  listDoneTasks(@Headers('x-user-id') user: string) { return this.flowable.listDoneTasks(user); }

  @Get('tasks/:id/form')
  getTaskForm(@Param('id') id: string) { return this.flowable.getTaskForm(id); }

  @Post('tasks/:id/complete')
  complete(
    @Param('id') id: string,
    @Body() body: { values: Record<string, any>; outcome?: string },
    @Headers('x-user-id') user: string,
  ) {
    return this.flowable.completeTask(id, body.values, body.outcome, user);
  }
}
