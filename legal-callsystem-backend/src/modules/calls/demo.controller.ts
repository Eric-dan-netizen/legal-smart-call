import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../customers/customer.entity';
import { CallTask } from './call-task.entity';
import { CallsService } from './calls.service';
import { LlmService, ChatMessage } from '../voice/llm.service';
import { CallTaskStatus } from './types';

const DEMO_CUSTOMER_TEXTS: Record<string, string[]> = {
  divorce: [
    '你好，我想咨询一下离婚的事。',
    '我和老公结婚八年了，他最近半年经常不回家，我怀疑他在外面有人了。',
    '我们有一套房子和一辆车，还有一个七岁的孩子。如果离婚，财产怎么分？',
  ],
  labor: [
    '你好，我想问一下劳动仲裁的事。',
    '我在公司干了四年，上个月突然被辞退了，没有任何补偿。',
    '我还有三个月的工资没发，一共两万多块钱。',
  ],
  debt: [
    '你好，我有个朋友借了我十万块钱，一直不还。',
    '有借条，当时也约定了利息，但是已经快三年了。',
    '他现在电话不接，微信也不回，我不知道该怎么办。',
  ],
  traffic: [
    '你好，我上个月出了个车祸，想咨询一下赔偿的问题。',
    '对方全责，我腿受伤了，住了二十天医院，花了三万多。',
    '对方保险公司只愿意赔一部分，我想了解一下我还能主张哪些赔偿。',
  ],
  general: [
    '你好，我想了解一下你们律所能提供哪些法律服务。',
    '我最近考虑自己开个小公司，需要了解一些法律方面的事项。',
    '你们是怎么收费的？可以先咨询一下吗？',
  ],
};

@Controller('demo')
export class DemoController {
  private readonly logger = new Logger(DemoController.name);

  constructor(
    private readonly callsService: CallsService,
    private readonly llmService: LlmService,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(CallTask)
    private readonly taskRepo: Repository<CallTask>,
  ) {}

  @Post('simulate-call')
  @HttpCode(HttpStatus.OK)
  async simulateCall(@Body() body: {
    customerId?: string;
    scriptId?: string;
    caseType?: string;
    rounds?: number;
  }) {
    const caseType = body.caseType || 'general';
    const maxRounds = Math.min(body.rounds || 2, 5);

    // 1. 查找客户
    let customer: Customer | null = null;
    if (body.customerId) {
      customer = await this.customerRepo.findOne({ where: { id: body.customerId } as any });
    }
    if (!customer) {
      customer = await this.customerRepo.findOne({ where: {} as any });
    }
    if (!customer) {
      return { success: false, message: '没有可用客户，请先运行 npm run seed' };
    }

    // 2. 创建任务
    const task = await this.taskRepo.save({
      tenant: (customer as any).tenant,
      name: `Demo 演示通话 - ${caseType}`,
      scriptId: body.scriptId || 'demo-script',
      scheduleTime: new Date(),
      status: CallTaskStatus.RUNNING,
      totalCount: 1,
      customerIds: [customer.id],
    } as any);

    // 3. 执行外呼（模拟模式）
    const callResult = await this.callsService.executeCall(task, customer.id);
    if (!callResult.success) {
      return { success: false, message: '外呼失败', error: callResult.error };
    }

    // 4. 模拟多轮对话
    const conversation: Array<{ role: string; content: string }> = [];
    const customerTexts = DEMO_CUSTOMER_TEXTS[caseType] || DEMO_CUSTOMER_TEXTS.general;
    const history: ChatMessage[] = [];

    for (let i = 0; i < Math.min(maxRounds, customerTexts.length); i++) {
      const userText = customerTexts[i];
      conversation.push({ role: 'user', content: userText });
      history.push({ role: 'user', content: userText });

      const aiReply = await this.llmService.chat({
        messages: [
          { role: 'system', content: '你是律师事务所的智能法律顾问。请用专业、自然的中文回复，50字以内。' },
          ...history,
        ],
        tenantId: 'demo',
      });

      conversation.push({ role: 'assistant', content: aiReply });
      history.push({ role: 'assistant', content: aiReply });

      this.logger.log(`Demo 对话轮次 ${i + 1}: ${userText.substring(0, 20)}... → ${aiReply.substring(0, 20)}...`);
    }

    return {
      success: true,
      data: {
        callId: callResult.callId,
        sessionId: callResult.sessionId,
        customer: { id: customer.id, name: customer.name },
        caseType,
        rounds: maxRounds,
        conversation,
      },
    };
  }
}
