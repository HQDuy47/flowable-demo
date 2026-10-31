import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { FlowableService } from './flowable.service.js';
import { WorkflowController } from './workflow.controller.js';

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
  controllers: [WorkflowController],
  providers: [FlowableService],
})
export class AppModule {}
