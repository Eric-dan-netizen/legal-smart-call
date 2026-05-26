import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CallTask } from './call-task.entity';
import { CallLog } from './call-log.entity';
import { Customer } from '../customers/customer.entity';
import { Tenant } from '../tenants/tenant.entity';
import { AliyunCallService } from './aliyun-call.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    @InjectRepository(CallTask)
    private taskRepo: Repository<CallTask>,
    @InjectRepository(CallLog)
    private logRepo: Repository<CallLog>,
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
    private configService: ConfigService,
    private aliyunCallService: AliyunCallService,
  ) {}

  async createTask(tenantId: string, data: CreateTaskDto) {
    const task = this.taskRepo.create({
      tenant: { id: tenantId } as any,
      name: data.name,
      scriptId: data.scriptId,
      scheduleTime: data.scheduleTime,
      status: 'pending',
      totalCount: data.customerIds?.length || 0,
      customerIds: data.customerIds || [],
      config: data.config || {},
    });
    return this.taskRepo.save(task);
  }

  async findAllTasks(tenantId: string, filters?: { status?: string; page?: number; limit?: number }) {
    const query = this.taskRepo.createQueryBuilder('task')
      .leftJoinAndSelect('task.callLogs', 'callLogs')
      .where('task.tenantId = :tenantId', { tenantId })
      .orderBy('task.createdAt', 'DESC');

    if (filters?.status) {
      query.andWhere('task.status = :status', { status: filters.status });
    }

    if (filters?.page && filters?.limit) {
      query.skip((filters.page - 1) * filters.limit)
         .take(filters.limit);
    }

    return query.getManyAndCount();
  }

  async getTask(tenantId: string, id: string) {
    const task = await this.taskRepo.findOne({
      where: { id, tenantId } as any,
      relations: ['callLogs'],
    });
    if (!task) throw new NotFoundException('任务不存在');
    return task;
  }

  async startTask(tenantId: string, id: string) {
    const task = await this.getTask(tenantId, id);
    if (task.status !== 'pending') {
      throw new BadRequestException('任务状态不允许启动');
    }
    await this.taskRepo.update(id, { status: 'running' });
    return this.processTask(task);
  }

  async pauseTask(tenantId: string, id: string) {
    await this.getTask(tenantId, id);
    await this.taskRepo.update(id, { status: 'paused' });
  }

  async cancelTask(tenantId: string, id: string) {
    await this.getTask(tenantId, id);
    await this.taskRepo.update(id, { status: 'cancelled' });
  }

  private async processTask(task: CallTask) {
    this.logger.log(`开始处理外呼任务：${task.name}, 客户数：${task.customerIds?.length}`);
    
    let successCount = 0;
    let failCount = 0;

    for (const customerId of task.customerIds || []) {
      try {
        const currentTask = await this.taskRepo.findOneBy({ id: task.id });
        if (currentTask?.status === 'paused' || currentTask?.status === 'cancelled') {
          this.logger.log(`任务 ${task.id} 已${currentTask.status === 'paused' ? '暂停' : '取消'}`);
          break;
        }

        const result = await this.makeCall(task, customerId);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        this.logger.error(`客户 ${customerId} 外呼失败: ${error.message}`);
        failCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await this.taskRepo.update(task.id, { 
      status: 'completed',
      completedCount: successCount,
      successCount,
      failedCount: failCount,
    });

    this.logger.log(`任务 ${task.name} 完成：成功 ${successCount}, 失败 ${failCount}`);
    return { successCount, failCount };
  }

  private async makeCall(task: CallTask, customerId: string) {
    const customer = await this.customerRepo.findOneBy({ id: customerId });
    
    if (!customer) {
      this.logger.warn(`客户 ${customerId} 不存在，跳过`);
      return { success: false, error: '客户不存在' };
    }

    const phone = this.decryptPhone(customer.phoneEncrypted);
    if (!phone) {
      this.logger.error(`客户 ${customerId} 手机号解密失败`);
      return { success: false, error: '手机号解密失败' };
    }

    const agentNumber = this.configService.get<string>('AGENT_NUMBER');
    if (!agentNumber) {
      this.logger.error('坐席号码未配置，请在环境变量中设置 AGENT_NUMBER');
      return { success: false, error: '坐席号码未配置，请在环境变量 AGENT_NUMBER 中设置' };
    }

    // 检查外呼时间（8:00-21:00）
    const now = new Date();
    const hour = now.getHours();
    if (hour < 8 || hour >= 21) {
      this.logger.warn(`当前时间 ${hour} 点不在允许外呼时间范围内（8:00-21:00）`);
      return { success: false, error: '不在允许外呼时间范围内' };
    }

    this.logger.log(`发起外呼：客户 ${phone} <- 坐席 ${agentNumber}`);
    
    try {
      const callResult = await this.aliyunCallService.makeCall(
        phone,
        agentNumber,
        task.scriptId,
        customerId,
      );

      const log = new CallLog();
      log.callId = callResult.callId;
      log.callStatus = 'initiated';
      log.duration = 0;
      log.intentResult = '';
      log.tenant = task.tenant;
      log.customer = customer;
      log.task = task;
      
      await this.logRepo.save(log);
      await this.taskRepo.increment({ id: task.id }, 'completedCount', 1);

      this.logger.log(`外呼成功：callId=${callResult.callId}, status=${callResult.status}`);
      
      return { success: true, callId: callResult.callId, status: callResult.status };
    } catch (error) {
      this.logger.error(`外呼失败：${error.message}`);
      return { success: false, error: error.message };
    }
  }

  private decryptPhone(encrypted: string): string {
    try {
      const key = this.configService.get<string>('TENANT_ENCRYPTION_KEY') || 'legal_call_encryption_32c';
      const bytes = CryptoJS.AES.decrypt(encrypted, key);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      this.logger.error(`手机号解密失败: ${error.message}`);
      return '';
    }
  }

  async setAgentNumber(tenantId: string, agentNumber: string) {
    const currentConfig: any = {};
    currentConfig.agentNumber = agentNumber;
    await this.taskRepo.manager.update('tenants', { id: tenantId }, { config: currentConfig });
    this.logger.log(`坐席号码已更新：${agentNumber}`);
  }

  async getCallLogs(tenantId: string, filters?: { 
    customerId?: string; 
    status?: string; 
    page?: number; 
    limit?: number 
  }) {
    const query = this.logRepo.createQueryBuilder('log')
      .where('log.tenantId = :tenantId', { tenantId })
      .orderBy('log.createdAt', 'DESC');

    if (filters?.customerId) {
      query.andWhere('log.customerId = :customerId', { customerId: filters.customerId });
    }
    if (filters?.status) {
      query.andWhere('log.callStatus = :status', { status: filters.status });
    }

    if (filters?.page && filters?.limit) {
      query.skip((filters.page - 1) * filters.limit)
         .take(filters.limit);
    }

    return query.getManyAndCount();
  }

  async updateCallLog(callId: string, data: { duration?: number; callStatus?: string; intentResult?: string; recordingUrl?: string }) {
    const log = await this.logRepo.findOne({ where: { callId } });
    if (log) {
      if (data.callStatus) log.callStatus = data.callStatus as any;
      if (data.duration) log.duration = data.duration;
      if (data.recordingUrl) log.recordingUrl = data.recordingUrl;
      await this.logRepo.save(log);
      this.logger.log(`通话记录已更新：callId=${callId}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async processScheduledTasks() {
    const now = new Date();
    const tasks = await this.taskRepo.find({
      where: {
        status: 'pending',
        scheduleTime: LessThan(now),
      },
    });

    for (const task of tasks) {
      try {
        await this.taskRepo.update(task.id, { status: 'running' });
        await this.processTask(task);
      } catch (e) {
        console.error(`任务 ${task.id} 执行失败:`, e);
        await this.taskRepo.update(task.id, { status: 'cancelled' });
      }
    }
  }
}

export interface CreateTaskDto {
  name: string;
  scriptId: string;
  scheduleTime: Date;
  customerIds?: string[];
  config?: Record<string, any>;
}