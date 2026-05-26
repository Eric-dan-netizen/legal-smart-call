import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CallTask } from './call-task.entity';
import { CallLog } from './call-log.entity';
import { Customer } from '../customers/customer.entity';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { AliyunCallService, TencentCallService } from './aliyun-call.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CallTask, CallLog, Customer]),
    ConfigModule,
  ],
  controllers: [CallsController],
  providers: [CallsService, AliyunCallService, TencentCallService],
  exports: [CallsService, AliyunCallService],
})
export class CallsModule {}