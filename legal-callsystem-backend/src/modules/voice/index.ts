import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { VoiceGatewayService } from './voice-gateway.service';
import { VoiceGateway } from './voice.gateway';
import { VoiceController } from './voice.controller';
import { AsrService } from './asr.service';
import { LlmService } from './llm.service';
import { TtsService } from './tts.service';
import { ScriptPromptBuilder } from './script-prompt.builder';
import { AliyunSignatureService } from '../common/aliyun-signature.service';

@Module({
  imports: [
    ConfigModule,
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  ],
  controllers: [VoiceController],
  providers: [
    VoiceGatewayService,
    VoiceGateway,
    AsrService,
    LlmService,
    TtsService,
    ScriptPromptBuilder,
    AliyunSignatureService,
  ],
  exports: [
    VoiceGatewayService,
    VoiceGateway,
    AsrService,
    LlmService,
    TtsService,
  ],
})
export class VoiceModule {}