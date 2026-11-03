import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { FlowableFormsService } from './flowable-forms.service.js';
import { FlowableService } from './flowable.service.js';
import { WorkflowController } from './workflow.controller.js';
import { RequestTypesController } from './request-types.controller.js';
import { RequestTypesService } from './request-types.service.js';

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
  controllers: [WorkflowController, RequestTypesController],
  providers: [FlowableService, FlowableFormsService, RequestTypesService],
})
export class AppModule {}
