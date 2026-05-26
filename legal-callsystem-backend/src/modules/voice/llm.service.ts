import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  tenantId: string;
  model?: string;
  temperature?: number;
}

/**
 * LLM 对话服务
 * 支持：硅基流动（DeepSeek 等）
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly apiBase: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor() {
    // 硅基流动配置
    this.apiBase = 'https://api.siliconflow.cn/v1';
    this.apiKey = process.env.SILICONFLOW_API_KEY || '';
    this.defaultModel = 'Pro/MiniMaxAI/MiniMax-M2.5';
  }

  /**
   * 对话生成
   */
  async chat(options: ChatOptions): Promise<string> {
    const { messages, tenantId, model, temperature } = options;
    
    const selectedModel = model || this.defaultModel;
    this.logger.log(`调用 LLM: ${selectedModel}`);

    try {
      const response = await axios.post(
        `${this.apiBase}/chat/completions`,
        {
          model: selectedModel,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          temperature: temperature ?? 0.7,
          max_tokens: 500,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000, // 15秒超时
        }
      );

      const reply = response.data.choices[0]?.message?.content || '';
      this.logger.debug(`LLM 回复: ${reply.substring(0, 100)}...`);
      
      return reply;
    } catch (error) {
      this.logger.error(`LLM 调用失败: ${error.message}`);
      // 降级处理：返回默认回复
      return '抱歉，我这边信号不太好，您方便再说一下您的需求吗？';
    }
  }

  /**
   * 流式对话（适用于实时语音）
   */
  async *chatStream(options: ChatOptions): AsyncGenerator<string> {
    const { messages, tenantId, model, temperature } = options;
    
    const selectedModel = model || this.defaultModel;
    
    try {
      const response = await axios.post(
        `${this.apiBase}/chat/completions`,
        {
          model: selectedModel,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          temperature: temperature ?? 0.7,
          max_tokens: 500,
          stream: true,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
        }
      );

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) yield content;
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`LLM 流式调用失败: ${error.message}`);
      yield '抱歉，我这边信号不太好，您方便再说一下您的需求吗？';
    }
  }
}