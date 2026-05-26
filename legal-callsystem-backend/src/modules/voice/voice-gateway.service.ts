import { Injectable, Logger } from '@nestjs/common';
import { AsrService } from './asr.service';
import { LlmService } from './llm.service';
import { TtsService } from './tts.service';

export interface ConversationContext {
  customerId: string;
  tenantId: string;
  scriptId?: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  metadata?: Record<string, any>;
}

export interface VoiceResponse {
  text: string;           // 识别的文字
  reply: string;         // AI 回复
  audioUrl: string;      // 合成的语音 URL
  duration: number;      // 语音时长(秒)
}

/**
 * 语音对话网关服务
 * 协调 ASR → LLM → TTS 完整链路
 */
@Injectable()
export class VoiceGatewayService {
  private readonly logger = new Logger(VoiceGatewayService.name);
  private readonly conversations = new Map<string, ConversationContext>();

  constructor(
    private readonly asrService: AsrService,
    private readonly llmService: LlmService,
    private readonly ttsService: TtsService,
  ) {}

  /**
   * 开始一个语音对话会话
   */
  async startConversation(
    customerId: string,
    tenantId: string,
    scriptId?: string,
  ): Promise<string> {
    const sessionId = `session_${Date.now()}_${customerId}`;
    
    // 获取话术配置
    const systemPrompt = await this.getSystemPrompt(tenantId, scriptId);
    
    this.conversations.set(sessionId, {
      customerId,
      tenantId,
      scriptId,
      history: [{ role: 'assistant', content: systemPrompt }],
    });
    
    this.logger.log(`开始对话会话: ${sessionId}`);
    return sessionId;
  }

  /**
   * 处理一轮对话
   * 语音输入 → 识别 → AI 回复 → 语音输出
   */
  async processRound(
    sessionId: string,
    audioBuffer: Buffer,
  ): Promise<VoiceResponse> {
    const context = this.conversations.get(sessionId);
    if (!context) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    this.logger.log(`处理对话轮次: ${sessionId}`);

    // 1. ASR 语音识别
    const recognizeResult = await this.asrService.recognize(audioBuffer);
    const customerText = recognizeResult.text;
    
    this.logger.log(`客户说: ${customerText}`);

    // 2. 添加客户回复到历史
    context.history.push({ role: 'user', content: customerText });

    // 3. LLM 生成回复
    const aiReply = await this.llmService.chat({
      messages: context.history,
      tenantId: context.tenantId,
    });

    this.logger.log(`AI 回复: ${aiReply}`);

    // 4. 添加 AI 回复到历史
    context.history.push({ role: 'assistant', content: aiReply });

    // 5. TTS 语音合成
    const audioUrl = await this.ttsService.synthesize(aiReply);
    const duration = await this.ttsService.getAudioDuration(audioUrl);

    return {
      text: customerText,
      reply: aiReply,
      audioUrl,
      duration,
    };
  }

  /**
   * 获取话术系统提示词
   */
  private async getSystemPrompt(tenantId: string, scriptId?: string): Promise<string> {
    // 从数据库获取话术配置
    // 这里使用默认的法律咨询开场白
    return `你是律所的智能客服，代表XX律师事务所。
你的任务是：
1. 礼貌问候来电客户
2. 了解客户的法律需求
3. 介绍律所服务和优势
4. 邀约客户到店咨询
5. 记录客户联系方式

注意事项：
- 态度专业、热情、有耐心
- 语速适中，发音清晰
- 遇到敏感问题（如投诉、费用等）灵活应对
- 客户明确表示不需要时，不要强推
- 通话结束前确认客户是否方便到店

请用简洁、自然的口吻与客户交流。`;
  }

  /**
   * 结束对话会话
   */
  endConversation(sessionId: string): void {
    this.conversations.delete(sessionId);
    this.logger.log(`结束对话会话: ${sessionId}`);
  }

  /**
   * 获取会话历史
   */
  getHistory(sessionId: string): Array<{ role: 'user' | 'assistant'; content: string }> {
    return this.conversations.get(sessionId)?.history || [];
  }
}