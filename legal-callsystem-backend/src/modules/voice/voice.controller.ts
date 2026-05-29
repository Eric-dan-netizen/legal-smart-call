import { Controller, Post, Body, HttpCode, HttpStatus, Logger, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VoiceGatewayService } from './voice-gateway.service';
import { LlmService } from './llm.service';
import { AsrService } from './asr.service';
import { TtsService } from './tts.service';

@Controller('voice')
export class VoiceController {
  private readonly logger = new Logger(VoiceController.name);

  constructor(
    private readonly voiceGateway: VoiceGatewayService,
    private readonly llmService: LlmService,
    private readonly asrService: AsrService,
    private readonly ttsService: TtsService,
  ) {}

  /**
   * 开始一个对话会话
   * POST /api/voice/start
   */
  @Post('start')
  @HttpCode(HttpStatus.OK)
  async startConversation(@Body() body: any) {
    const callId = body.sessionId || `rest_${Date.now()}_${body.customerId || 'anon'}`;
    const sessionId = await this.voiceGateway.startConversation(
      callId,
      body.customerId || 'rest-user',
      body.tenantId || 'default',
      body.scriptId,
    );

    return {
      success: true,
      data: { sessionId },
      message: '对话会话已开启',
    };
  }

  /**
   * 发送消息并获取回复（集成 LLM）
   * POST /api/voice/chat
   */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() body: any) {
    const { sessionId, text } = body;

    if (!text) {
      return {
        success: false,
        message: '请提供 text 参数',
      };
    }

    try {
      // 获取或创建会话
      let useSessionId = sessionId;
      if (!useSessionId) {
        useSessionId = `rest_${Date.now()}_chat`;
        await this.voiceGateway.startConversation(
          useSessionId,
          'test-customer',
          'test-tenant',
        );
      }
      
      // 获取历史消息
      const history = this.voiceGateway.getHistory(useSessionId);
      
      // 添加当前用户消息
      history.push({ role: 'user', content: text });
      
      // 调用 LLM 获取回复
      const aiReply = await this.llmService.chat({
        messages: history,
        tenantId: 'test-tenant',
      });
      
      // 添加 AI 回复到历史
      history.push({ role: 'assistant', content: aiReply });

      return {
        success: true,
        data: {
          sessionId: useSessionId,
          text: text,
          reply: aiReply,
        },
      };
    } catch (error) {
      this.logger.error('LLM 调用失败: ' + error.message);
      return {
        success: false,
        message: 'AI 回复失败: ' + error.message,
      };
    }
  }

  /**
   * 上传音频并进行语音对话
   * POST /api/voice/chat/audio
   */
  @Post('chat/audio')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('audio'))
  async chatWithAudio(@Body() body: any, @UploadedFile() audio: any) {
    if (!audio) {
      return { success: false, message: '请上传音频文件 (字段名: audio)' };
    }

    try {
      const asrResult = await this.asrService.recognize(audio.buffer);

      let sessionId = body.sessionId;
      if (!sessionId) {
        sessionId = `rest_${Date.now()}_audio`;
        await this.voiceGateway.startConversation(sessionId, body.customerId || 'audio-user', body.tenantId || 'test-tenant');
      }
      const history = this.voiceGateway.getHistory(sessionId);
      history.push({ role: 'user', content: asrResult.text });

      const aiReply = await this.llmService.chat({
        messages: history,
        tenantId: body.tenantId || 'test-tenant',
      });
      history.push({ role: 'assistant', content: aiReply });

      const audioPath = await this.ttsService.synthesize(aiReply);

      return {
        success: true,
        data: {
          sessionId,
          userText: asrResult.text,
          aiReply,
          audioPath,
          confidence: asrResult.confidence,
        },
      };
    } catch (error) {
      this.logger.error(`音频对话失败: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  /**
   * 结束对话会话
   * POST /api/voice/end
   */
  @Post('end')
  @HttpCode(HttpStatus.OK)
  endConversation(@Body() body: any) {
    if (body.sessionId) {
      this.voiceGateway.endConversation(body.sessionId);
    }
    
    return {
      success: true,
      message: '对话会话已结束',
    };
  }

  /**
   * 获取对话历史
   * POST /api/voice/history
   */
  @Post('history')
  @HttpCode(HttpStatus.OK)
  getHistory(@Body() body: any) {
    const history = body.sessionId ? this.voiceGateway.getHistory(body.sessionId) : [];
    
    return {
      success: true,
      data: { history },
    };
  }
}