import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CallTask } from './call-task.entity';
import { CallLog } from './call-log.entity';
import { Customer } from '../customers/customer.entity';
import { Script } from '../scripts/script.entity';
import { AliyunCallService } from './aliyun-call.service';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * 外呼引擎核心服务
 * 负责调度外呼任务、对接云通信 API、记录通话结果
 */
@Injectable()
export class CallEngineService {
  private readonly logger = new Logger(CallEngineService.name);
  
  // 并发控制
  private readonly maxConcurrentCalls = 5;
  private runningCalls = 0;
  private callQueue: Array<{ task: CallTask; customerId: string }> = [];

  constructor(
    @InjectRepository(CallTask)
    private taskRepo: Repository<CallTask>,
    @InjectRepository(CallLog)
    private logRepo: Repository<CallLog>,
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
    @InjectRepository(Script)
    private scriptRepo: Repository<Script>,
    private aliyunCallService: AliyunCallService,
  ) {}

  /**
   * 处理外呼任务
   */
  async processTask(task: CallTask) {
    this.logger.log(`开始处理外呼任务：${task.name}`);

    const customerIds = task.customerIds || [];
    let processed = 0;

    for (const customerId of customerIds) {
      // 检查任务是否被暂停/取消
      const currentTask = await this.taskRepo.findOne({ where: { id: task.id } });
      if (currentTask?.status !== 'running') {
        this.logger.warn(`任务 ${task.id} 已停止`);
        break;
      }

      // 并发控制
      while (this.runningCalls >= this.maxConcurrentCalls) {
        await this.sleep(1000);
      }

      this.executeCall(task, customerId).catch((err) => {
        this.logger.error(`呼叫客户 ${customerId} 失败:`, err);
      });

      processed++;
    }

    this.logger.log(`任务 ${task.name} 处理完成，共 ${processed} 通电话`);
  }

  /**
   * 执行单次外呼
   */
  private async executeCall(task: CallTask, customerId: string) {
    this.runningCalls++;

    try {
      // 1. 获取客户信息
      const customer = await this.customerRepo.findOne({
        where: { id: customerId },
        relations: ['tenant'],
      });

      if (!customer) {
        this.logger.warn(`客户 ${customerId} 不存在`);
        return;
      }

      // 2. 获取话术
      const script = await this.scriptRepo.findOne({
        where: { id: task.scriptId },
      });

      if (!script) {
        this.logger.warn(`话术 ${task.scriptId} 不存在`);
        return;
      }

      // 3. 发起外呼（对接阿里云）
      const callResult = await this.aliyunCallService.makeCall(
        customer.phoneEncrypted, // 实际需先解密
        script.audioUrl || script.textContent,
        customerId,
      );

      // 4. 创建通话记录
      const callLog = this.logRepo.create({
        tenant: task.tenant,
        customer: { id: customerId } as any,
        task,
        callStatus: 'answered', // 实际需从回调获取
        duration: 0,
        intentResult: 'pending',
      });

      await this.logRepo.save(callLog);

      // 5. 更新任务进度
      await this.taskRepo.increment({ id: task.id }, 'completedCount', 1);

      this.logger.log(`外呼完成：${customer.name}, 通话 ID: ${callResult.callId}`);
    } catch (error) {
      this.logger.error(`外呼失败：${customerId}`, error);
      
      // 记录失败
      const failedLog = this.logRepo.create({
        tenant: task.tenant,
        customer: { id: customerId } as any,
        task,
        callStatus: 'failed',
        duration: 0,
      });
      await this.logRepo.save(failedLog);
    } finally {
      this.runningCalls--;
      this.processQueue();
    }
  }

  /**
   * 处理队列中的下一个呼叫
   */
  private processQueue() {
    if (this.callQueue.length > 0 && this.runningCalls < this.maxConcurrentCalls) {
      const next = this.callQueue.shift();
      if (next) {
        this.executeCall(next.task, next.customerId);
      }
    }
  }

  /**
   * 处理通话回调（阿里云回调 webhook）
   */
  async handleCallCallback(data: {
    callId: string;
    customerId: string;
    status: 'answered' | 'no_answer' | 'busy' | 'rejected';
    duration: number;
    recordingUrl: string;
    transcript?: string;
  }) {
    this.logger.log(`收到通话回调：${data.callId}, 状态：${data.status}`);

    // 更新通话记录
    await this.logRepo.update(
      { /* 根据 callId 或 customerId 查找 */ },
      {
        callStatus: data.status,
        duration: data.duration,
        recordingUrl: data.recordingUrl,
        transcript: data.transcript,
        intentResult: this.analyzeIntent(data.transcript),
      },
    );

    // 更新客户状态
    if (data.status === 'answered') {
      await this.customerRepo.update(
        { id: data.customerId },
        {
          lastCallAt: new Date(),
          status: 'contacted',
        },
      );
    }
  }

  /**
   * 分析通话意图（关键词匹配）
   */
  private analyzeIntent(transcript?: string): string {
    if (!transcript) return 'unknown';

    const keywords: Record<string, string> = {
      '有时间': 'positive',
      '可以': 'positive',
      '加微信': 'positive',
      '好的': 'positive',
      '不需要': 'negative',
      '没兴趣': 'negative',
      '在忙': 'callback',
      '稍后': 'callback',
    };

    for (const [keyword, intent] of Object.entries(keywords)) {
      if (transcript.includes(keyword)) {
        return intent;
      }
    }

    return 'unknown';
  }

  /**
   * 定时检查待执行任务
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkScheduledTasks() {
    const now = new Date();
    
    const tasks = await this.taskRepo.find({
      where: {
        status: 'pending',
        scheduleTime: LessThan(now),
      },
      relations: ['tenant'],
    });

    for (const task of tasks) {
      try {
        await this.taskRepo.update(task.id, { status: 'running' });
        await this.processTask(task);
      } catch (error) {
        this.logger.error(`定时任务执行失败：${task.id}`, error);
        await this.taskRepo.update(task.id, { status: 'cancelled' });
      }
    }
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 需要导入 LessThan
import { LessThan } from 'typeorm';
