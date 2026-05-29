import { Injectable, Logger } from '@nestjs/common';
import { AsrService } from './asr.service';
import { LlmService } from './llm.service';
import { TtsService } from './tts.service';
import { ScriptPromptBuilder } from './script-prompt.builder';

export interface ConversationContext {
  customerId: string;
  tenantId: string;
  scriptId?: string;
  history: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  lastActivity: Date;
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
    private readonly promptBuilder: ScriptPromptBuilder,
  ) {}

  /**
   * 开始一个语音对话会话
   * @param callId 通话标识，用作会话 key（WebSocket 和 REST 统一使用）
   * @param systemPrompt 可选，自定义系统提示词。不传则使用默认法律话术。
   */
  async startConversation(
    callId: string,
    customerId: string,
    tenantId: string,
    scriptId?: string,
    systemPrompt?: string,
  ): Promise<string> {
    const prompt = systemPrompt || this.promptBuilder.buildSystemPrompt();

    this.conversations.set(callId, {
      customerId,
      tenantId,
      scriptId,
      history: [{ role: 'system', content: prompt }],
      lastActivity: new Date(),
    });

    this.logger.log(`开始对话会话: ${callId}`);
    return callId;
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
    context.lastActivity = new Date();

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

    // 6. 检测结束意图
    const endingKeywords = ['祝您生活愉快', '再见', '感谢您的来电', '稍后联系', '保持联系'];
    if (endingKeywords.some(kw => aiReply.includes(kw))) {
      this.logger.log(`检测到结束意图，自动结束会话: ${sessionId}`);
      this.conversations.delete(sessionId);
    }

    return {
      text: customerText,
      reply: aiReply,
      audioUrl,
      duration,
    };
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
  getHistory(sessionId: string): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    return this.conversations.get(sessionId)?.history || [];
  }

  /**
   * 获取通话状态
   */
  getCallStatus(sessionId: string): 'active' | 'idle' | 'ended' {
    const context = this.conversations.get(sessionId);
    if (!context) return 'ended';

    const idleMs = Date.now() - context.lastActivity.getTime();
    if (idleMs > 5 * 60 * 1000) return 'idle';
    return 'active';
  }

  /**
   * 定时清理过期会话（超过 10 分钟无活动）
   */
  cleanStaleSessions(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, ctx] of this.conversations) {
      if (now - ctx.lastActivity.getTime() > 10 * 60 * 1000) {
        this.conversations.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.logger.log(`清理过期会话: ${cleaned} 个`);
    }
    return cleaned;
  }
}