import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { WorkflowService } from './workflow.service.js';

/** Lập đơn, việc chờ duyệt, duyệt. Người dùng hiện tại lấy từ header "x-user-id" do frontend gửi. */
@Controller('api')
export class WorkflowController {
  constructor(private readonly workflow: WorkflowService) {}

  @Get('processes')
  listProcesses() {
    return this.workflow.listProcesses();
  }

  @Get('processes/:id/start-form')
  getStartForm(@Param('id') id: string) {
    return this.workflow.getStartForm(id);
  }

  /** Dữ liệu được kiểm tra lại theo JSON Schema (bắt buộc, kiểu, rule): không tin dữ liệu từ trình duyệt. */
  @Post('processes/:key/start')
  start(
    @Param('key') key: string,
    @Body() body: { values?: unknown },
    @Headers('x-user-id') user: string,
  ) {
    return this.workflow.startProcess(key, body?.values, user);
  }

  @Get('requests/:id')
  getRequest(@Param('id') id: string) {
    return this.workflow.getRequest(id);
  }

  /** Việc đang chờ user hiện tại duyệt */
  @Get('tasks')
  listTasks(@Headers('x-user-id') user: string) {
    return this.workflow.listTasks(user);
  }

  /** Việc user hiện tại đã duyệt xong */
  @Get('tasks/done')
  listDoneTasks(@Headers('x-user-id') user: string) {
    return this.workflow.listDoneTasks(user);
  }

  @Get('tasks/:id/form')
  getTaskForm(@Param('id') id: string) {
    return this.workflow.getTaskForm(id);
  }

  @Post('tasks/:id/complete')
  complete(
    @Param('id') id: string,
    @Body() body: { values?: unknown; outcome?: string },
    @Headers('x-user-id') user: string,
  ) {
    return this.workflow.completeTask(id, body?.values, body?.outcome, user);
  }
}
