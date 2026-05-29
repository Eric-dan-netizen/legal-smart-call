import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallLog } from '../calls/call-log.entity';
import { CallTask } from '../calls/call-task.entity';
import { Customer } from '../customers/customer.entity';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [TypeOrmModule.forFeature([CallLog, CallTask, Customer])],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
