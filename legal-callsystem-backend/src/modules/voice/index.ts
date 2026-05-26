import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { VoiceGatewayService } from './voice-gateway.service';
import { VoiceController } from './voice.controller';
import { AsrService } from './asr.service';
import { LlmService } from './llm.service';
import { TtsService } from './tts.service';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  ],
  controllers: [VoiceController],
  providers: [
    VoiceGatewayService,
    AsrService,
    LlmService,
    TtsService,
  ],
  exports: [
    VoiceGatewayService,
    AsrService,
    LlmService,
    TtsService,
  ],
})
export class VoiceModule {}