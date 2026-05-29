import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CallLog } from '../calls/call-log.entity';
import { CallTask } from '../calls/call-task.entity';
import { Customer } from '../customers/customer.entity';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(CallLog)
    private readonly logRepo: Repository<CallLog>,
    @InjectRepository(CallTask)
    private readonly taskRepo: Repository<CallTask>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async getOverview(tenantId: string) {
    const [callStats, taskStats, customerStats] = await Promise.all([
      this.getCallStats(tenantId),
      this.getTaskStats(tenantId),
      this.getCustomerStats(tenantId),
    ]);

    return { ...callStats, ...taskStats, ...customerStats };
  }

  private async getCallStats(tenantId: string) {
    const where = { tenant: { id: tenantId } } as any;

    const [
      totalCalls,
      connected,
      interested,
      notInterested,
    ] = await Promise.all([
      this.logRepo.count({ where }),
      this.logRepo.count({ where: { ...where, callStatus: 'completed' } }),
      this.logRepo.count({ where: { ...where, intentResult: 'positive' } }),
      this.logRepo.count({ where: { ...where, intentResult: 'negative' } }),
    ]);

    return {
      totalCalls,
      connected,
      connectRate: totalCalls > 0 ? Math.round((connected / totalCalls) * 100) : 0,
      interested,
      notInterested,
      convertRate: connected > 0 ? Math.round((interested / connected) * 100) : 0,
    };
  }

  private async getTaskStats(tenantId: string) {
    const where = { tenant: { id: tenantId } } as any;
    const [running, completed] = await Promise.all([
      this.taskRepo.count({ where: { ...where, status: 'running' } }),
      this.taskRepo.count({ where: { ...where, status: 'completed' } }),
    ]);
    return { runningTasks: running, completedTasks: completed };
  }

  private async getCustomerStats(tenantId: string) {
    const where = { tenantId } as any;

    const [totalCustomers, newCustomers, following] = await Promise.all([
      this.customerRepo.count({ where }),
      this.customerRepo.count({ where: { ...where, status: 'new' } }),
      this.customerRepo.count({ where: { ...where, status: 'contacted' } }),
    ]);

    return { totalCustomers, newCustomers, following };
  }

  async getTrend(tenantId: string, days: number = 7) {
    const result: Array<{ date: string; calls: number; connected: number }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().substring(5, 10);

      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);

      const where = {
        tenant: { id: tenantId },
        createdAt: Between(dayStart, dayEnd),
      } as any;

      const [calls, connected] = await Promise.all([
        this.logRepo.count({ where }),
        this.logRepo.count({ where: { ...where, callStatus: 'completed' } }),
      ]);

      result.push({ date: dateStr, calls, connected });
    }

    return result;
  }
}
