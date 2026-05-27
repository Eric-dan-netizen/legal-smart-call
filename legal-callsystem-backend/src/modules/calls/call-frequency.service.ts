import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CallFrequency } from './call-frequency.entity';
import * as crypto from 'crypto';

@Injectable()
export class CallFrequencyService {
  private readonly logger = new Logger(CallFrequencyService.name);

  constructor(
    @InjectRepository(CallFrequency)
    private frequencyRepo: Repository<CallFrequency>,
  ) {}

  private hashPhone(phone: string): string {
    return crypto.createHash('sha256').update(phone).digest('hex');
  }

  private getWeekInfo(): { year: number; weekNumber: number } {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    return {
      year: now.getFullYear(),
      weekNumber: Math.ceil((days + startOfYear.getDay() + 1) / 7),
    };
  }

  async canCall(tenantId: string, phone: string): Promise<{
    allowed: boolean;
    reason?: string;
    currentCount?: number;
    maxCount?: number;
  }> {
    // 检查时间窗口
    const hour = new Date().getHours();
    if (hour < 8 || hour >= 21) {
      return { allowed: false, reason: '不在允许外呼时段（8:00-21:00）' };
    }

    const { year, weekNumber } = this.getWeekInfo();
    const phoneHash = this.hashPhone(phone);
    const maxCalls = 3;

    const record = await this.frequencyRepo.findOne({
      where: { tenantId, phoneHash, year, weekNumber } as any,
    });

    const currentCount = record?.callCount || 0;
    if (currentCount >= maxCalls) {
      return {
        allowed: false,
        reason: `本周已外呼 ${currentCount} 次，达到上限 ${maxCalls} 次`,
        currentCount,
        maxCount: maxCalls,
      };
    }

    return { allowed: true, currentCount, maxCount: maxCalls };
  }

  async recordCall(tenantId: string, phone: string): Promise<void> {
    const { year, weekNumber } = this.getWeekInfo();
    const phoneHash = this.hashPhone(phone);

    const result = await this.frequencyRepo.increment(
      { tenantId, phoneHash, year, weekNumber } as any,
      'callCount',
      1,
    );

    if (result.affected === 0) {
      const record = this.frequencyRepo.create({
        tenantId,
        phoneHash,
        year,
        weekNumber,
        callCount: 1,
        lastCallAt: new Date(),
      });
      await this.frequencyRepo.save(record);
    } else {
      await this.frequencyRepo.update(
        { tenantId, phoneHash, year, weekNumber } as any,
        { lastCallAt: new Date() },
      );
    }
  }

  async getHistory(tenantId: string, phone: string) {
    const phoneHash = this.hashPhone(phone);
    return this.frequencyRepo.find({
      where: { tenantId, phoneHash } as any,
      order: { year: 'DESC', weekNumber: 'DESC' },
      take: 12,
    });
  }

  async getStats(tenantId: string) {
    const { year, weekNumber } = this.getWeekInfo();

    const [weeklyStats, totalRecords] = await Promise.all([
      this.frequencyRepo
        .createQueryBuilder('f')
        .select('SUM(f.callCount)', 'totalCalls')
        .addSelect('COUNT(DISTINCT f.phoneHash)', 'uniquePhones')
        .where('f.tenantId = :tenantId', { tenantId })
        .andWhere('f.year = :year', { year })
        .andWhere('f.weekNumber = :weekNumber', { weekNumber })
        .getRawOne(),
      this.frequencyRepo.count({ where: { tenantId } as any }),
    ]);

    return {
      currentWeek: { year, weekNumber },
      totalCallsThisWeek: Number(weeklyStats?.totalCalls) || 0,
      uniquePhonesThisWeek: Number(weeklyStats?.uniquePhones) || 0,
      totalRecords,
    };
  }

  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldRecords() {
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const deleted = await this.frequencyRepo.delete({
      lastCallAt: LessThan(twelveWeeksAgo),
    } as any);

    this.logger.log(`清理过期频率记录：${deleted.affected || 0} 条`);
  }
}
