import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as CryptoJS from 'crypto-js';
import { CallTask } from './call-task.entity';
import { CallLog } from './call-log.entity';
import { Customer } from '../customers/customer.entity';
import { AliyunCallService } from './aliyun-call.service';
import { BlacklistService } from './blacklist.service';
import { CallFrequencyService } from './call-frequency.service';
import { VoiceGatewayService } from '../voice/voice-gateway.service';
import { CallTaskStatus, CallStatus } from './types';

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
    private blacklistService: BlacklistService,
    private frequencyService: CallFrequencyService,
    private voiceGateway: VoiceGatewayService,
  ) {}

  async createTask(tenantId: string, data: CreateTaskDto) {
    const task = this.taskRepo.create({
      tenant: { id: tenantId } as any,
      name: data.name,
      scriptId: data.scriptId,
      scheduleTime: data.scheduleTime,
      status: CallTaskStatus.PENDING,
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
      query.skip((filters.page - 1) * filters.limit).take(filters.limit);
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
    if (task.status !== CallTaskStatus.PENDING) {
      throw new BadRequestException('任务状态不允许启动');
    }
    await this.taskRepo.update(id, { status: CallTaskStatus.RUNNING });
    return this.processTask(task);
  }

  async pauseTask(tenantId: string, id: string) {
    await this.getTask(tenantId, id);
    await this.taskRepo.update(id, { status: CallTaskStatus.PAUSED });
  }

  async cancelTask(tenantId: string, id: string) {
    await this.getTask(tenantId, id);
    await this.taskRepo.update(id, { status: CallTaskStatus.CANCELLED });
  }

  private async processTask(task: CallTask) {
    this.logger.log(`开始处理外呼任务：${task.name}, 客户数：${task.customerIds?.length}`);

    let successCount = 0;
    let failCount = 0;

    for (const customerId of task.customerIds || []) {
      try {
        const currentTask = await this.taskRepo.findOneBy({ id: task.id });
        if (currentTask?.status === CallTaskStatus.PAUSED || currentTask?.status === CallTaskStatus.CANCELLED) {
          this.logger.log(`任务 ${task.id} 已${currentTask.status === CallTaskStatus.PAUSED ? '暂停' : '取消'}`);
          break;
        }

        const result = await this.executeCall(task, customerId);
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
      status: CallTaskStatus.COMPLETED,
      completedCount: successCount,
      successCount,
      failedCount: failCount,
    });

    this.logger.log(`任务 ${task.name} 完成：成功 ${successCount}, 失败 ${failCount}`);
    return { successCount, failCount };
  }

  async executeCall(task: CallTask, customerId: string): Promise<{ success: boolean; callId?: string; sessionId?: string; error?: string }> {
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

    const tenantId = (customer as any).tenantId || task.tenant?.id;

    // 1. 黑名单检查
    const isBlacklisted = await this.blacklistService.isBlacklisted(tenantId, phone);
    if (isBlacklisted) {
      this.logger.warn(`客户 ${customerId} 在黑名单中，跳过外呼`);
      return { success: false, error: '客户已退订（黑名单）' };
    }

    // 2. 频率限制检查
    const frequencyCheck = await this.frequencyService.canCall(tenantId, phone);
    if (!frequencyCheck.allowed) {
      this.logger.warn(`客户 ${customerId} 频率限制：${frequencyCheck.reason}`);
      return { success: false, error: frequencyCheck.reason };
    }

    const callNumber = this.configService.get<string>('ALIYUN_CALL_NUMBER');
    if (!callNumber) {
      return this.simulateCall(task, customer, phone);
    }

    const agentNumber = this.configService.get<string>('AGENT_NUMBER');
    if (!agentNumber) {
      this.logger.error('坐席号码未配置');
      return { success: false, error: '坐席号码未配置' };
    }

    this.logger.log(`发起外呼：客户 ${phone} <- 坐席 ${agentNumber}`);

    try {
      const callResult = await this.aliyunCallService.makeCall(phone, agentNumber, task.scriptId, customerId);

      const log = this.logRepo.create({
        callId: callResult.callId,
        callStatus: CallStatus.INITIATED,
        duration: 0,
        tenant: task.tenant,
        customer,
        task,
      });
      await this.logRepo.save(log);
      await this.taskRepo.increment({ id: task.id }, 'completedCount', 1);
      await this.frequencyService.recordCall(tenantId, phone);

      const sessionId = await this.voiceGateway.startConversation(
        callResult.callId,
        customerId,
        tenantId,
        task.scriptId,
      );

      this.logger.log(`外呼成功：callId=${callResult.callId}, session=${sessionId}`);
      return { success: true, callId: callResult.callId, sessionId };
    } catch (error) {
      this.logger.error(`外呼失败：${error.message}`);
      await this.logRepo.save(
        this.logRepo.create({
          callStatus: CallStatus.FAILED,
          duration: 0,
          tenant: task.tenant,
          customer,
          task,
          errorMsg: error.message,
        }),
      );
      return { success: false, error: error.message };
    }
  }

  private async simulateCall(
    task: CallTask,
    customer: Customer,
    phone: string,
  ): Promise<{ success: boolean; callId: string; sessionId: string }> {
    const callId = `mock_${Date.now()}_${phone.slice(-4)}`;
    this.logger.log(`模拟外呼：${phone} (CALL_NUMBER 未配置)`);

    const tenantId = (customer as any).tenantId || task.tenant?.id;

    // 状态流转：INITIATED → ANSWERED
    const log = this.logRepo.create({
      callId,
      callStatus: CallStatus.INITIATED,
      duration: 0,
      tenant: task.tenant,
      customer,
      task,
    });
    await this.logRepo.save(log);

    const sessionId = await this.voiceGateway.startConversation(
      callId,
      customer.id,
      tenantId,
      task.scriptId,
    );

    // 转为 ANSWERED → IN_CONVERSATION
    await this.logRepo.update(log.id, {
      callStatus: CallStatus.ANSWERED,
      sessionId,
    });

    await this.frequencyService.recordCall(tenantId, phone);
    await this.taskRepo.increment({ id: task.id }, 'completedCount', 1);

    return { success: true, callId, sessionId };
  }

  async handleCallCallback(data: {
    callId: string;
    status: string;
    duration: number;
    recordingUrl?: string;
    transcript?: string;
  }) {
    this.logger.log(`通话回调：${data.callId}, 状态：${data.status}`);

    const log = await this.logRepo.findOne({ where: { callId: data.callId } });
    if (!log) {
      this.logger.warn(`未找到通话记录：${data.callId}`);
      return;
    }

    const statusMap: Record<string, CallStatus> = {
      answered: CallStatus.ANSWERED,
      completed: CallStatus.COMPLETED,
      no_answer: CallStatus.NO_ANSWER,
      busy: CallStatus.BUSY,
      rejected: CallStatus.REJECTED,
      failed: CallStatus.FAILED,
    };

    log.callStatus = statusMap[data.status] || CallStatus.FAILED;
    log.duration = data.duration;
    if (data.recordingUrl) log.recordingUrl = data.recordingUrl;
    if (data.transcript) log.transcript = data.transcript;
    if (data.transcript) log.intentResult = this.analyzeIntent(data.transcript);

    await this.logRepo.save(log);
  }

  private analyzeIntent(transcript?: string): string {
    if (!transcript) return 'unknown';
    const keywords: Record<string, string> = {
      '有时间': 'positive', '可以': 'positive', '加微信': 'positive', '好的': 'positive',
      '不需要': 'negative', '没兴趣': 'negative',
      '在忙': 'callback', '稍后': 'callback',
    };
    for (const [keyword, intent] of Object.entries(keywords)) {
      if (transcript.includes(keyword)) return intent;
    }
    return 'unknown';
  }

  async setAgentNumber(tenantId: string, agentNumber: string) {
    this.logger.log(`坐席号码已更新：${agentNumber}`);
    return { agentNumber };
  }

  async updateCallLog(callId: string, data: { duration?: number; callStatus?: string; intentResult?: string; recordingUrl?: string }) {
    const log = await this.logRepo.findOne({ where: { callId } });
    if (log) {
      if (data.callStatus) log.callStatus = data.callStatus as CallStatus;
      if (data.duration) log.duration = data.duration;
      if (data.recordingUrl) log.recordingUrl = data.recordingUrl;
      await this.logRepo.save(log);
    }
  }

  async updateCallStatus(callId: string, status: CallStatus): Promise<void> {
    const log = await this.logRepo.findOne({ where: { callId } });
    if (log) {
      log.callStatus = status;
      if (status === CallStatus.COMPLETED) {
        log.conversationEndedAt = new Date();
      }
      await this.logRepo.save(log);
      this.logger.log(`通话状态更新: ${callId} → ${status}`);
    }
  }

  async endCallConversation(callId: string): Promise<void> {
    this.voiceGateway.endConversation(callId);
    await this.updateCallStatus(callId, CallStatus.COMPLETED);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processScheduledTasks() {
    const now = new Date();
    const tasks = await this.taskRepo.find({
      where: { status: CallTaskStatus.PENDING, scheduleTime: LessThan(now) },
    });

    for (const task of tasks) {
      try {
        await this.taskRepo.update(task.id, { status: CallTaskStatus.RUNNING });
        await this.processTask(task);
      } catch (error) {
        this.logger.error(`定时任务执行失败：${task.id}`, error);
        await this.taskRepo.update(task.id, { status: CallTaskStatus.CANCELLED });
      }
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

  async getCallLogs(tenantId: string, filters?: {
    customerId?: string; status?: string; page?: number; limit?: number;
  }) {
    const query = this.logRepo.createQueryBuilder('log')
      .where('log.tenantId = :tenantId', { tenantId })
      .orderBy('log.createdAt', 'DESC');

    if (filters?.customerId) query.andWhere('log.customerId = :customerId', { customerId: filters.customerId });
    if (filters?.status) query.andWhere('log.callStatus = :status', { status: filters.status });
    if (filters?.page && filters?.limit) query.skip((filters.page - 1) * filters.limit).take(filters.limit);

    return query.getManyAndCount();
  }
}

export interface CreateTaskDto {
  name: string;
  scriptId: string;
  scheduleTime: Date;
  customerIds?: string[];
  config?: Record<string, any>;
}
