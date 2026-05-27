import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CallTask } from './call-task.entity';
import { CallLog } from './call-log.entity';
import { Blacklist } from './blacklist.entity';
import { CallFrequency } from './call-frequency.entity';
import { Customer } from '../customers/customer.entity';
import { CallsController } from './calls.controller';
import { BlacklistController } from './blacklist.controller';
import { FrequencyController } from './frequency.controller';
import { CallsService } from './calls.service';
import { BlacklistService } from './blacklist.service';
import { CallFrequencyService } from './call-frequency.service';
import { AliyunCallService, TencentCallService } from './aliyun-call.service';
import { AliyunSignatureService } from '../common/aliyun-signature.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CallTask, CallLog, Blacklist, CallFrequency, Customer]),
    ConfigModule,
  ],
  controllers: [CallsController, BlacklistController, FrequencyController],
  providers: [CallsService, BlacklistService, CallFrequencyService, AliyunCallService, TencentCallService, AliyunSignatureService],
  exports: [CallsService, BlacklistService, CallFrequencyService, AliyunCallService],
})
export class CallsModule {}