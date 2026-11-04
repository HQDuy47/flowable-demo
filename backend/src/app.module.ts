import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AuthController } from './auth/auth.controller.js';
import { DatabaseService } from './common/database.service.js';
import { FlowableFormsService } from './forms/flowable-forms.service.js';
import { FormSchemasService } from './forms/form-schemas.service.js';
import { FormsController } from './forms/forms.controller.js';
import { RequestTypesController } from './request-types/request-types.controller.js';
import { RequestTypesService } from './request-types/request-types.service.js';
import { WorkflowController } from './workflow/workflow.controller.js';
import { WorkflowService } from './workflow/workflow.service.js';

// ponytail: một module cho cả app, chia thư mục theo feature; tách Nest module riêng khi app lớn hơn
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        baseURL: c.get('FLOWABLE_URL'),
        auth: { username: c.get('FLOWABLE_USER')!, password: c.get('FLOWABLE_PASSWORD')! },
      }),
    }),
  ],
  controllers: [AuthController, WorkflowController, FormsController, RequestTypesController],
  providers: [DatabaseService, FlowableFormsService, FormSchemasService, RequestTypesService, WorkflowService],
})
export class AppModule {}
