import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { VoiceModule } from '../../src/modules/voice/index';
import { LlmService } from '../../src/modules/voice/llm.service';
import { TtsService } from '../../src/modules/voice/tts.service';

describe('Voice Pipeline Integration (v0.7)', () => {
  let llmService: LlmService;
  let ttsService: TtsService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ envFilePath: '.env' }),
        VoiceModule,
      ],
    }).compile();

    llmService = module.get(LlmService);
    ttsService = module.get(TtsService);
  });

  it('LLM should respond to legal consultation prompt', async () => {
    const reply = await llmService.chat({
      messages: [
        { role: 'system', content: '你是律师事务所的智能法律顾问。用专业、亲切的口吻回复客户，30字以内。' },
        { role: 'user', content: '你好，我想咨询一下劳动仲裁，公司拖欠三个月工资了。' },
      ],
      tenantId: 'integration-test',
    });

    expect(reply).toBeTruthy();
    expect(reply.length).toBeGreaterThan(10);
  }, 20000);

  it('LLM should handle divorce consultation', async () => {
    const reply = await llmService.chat({
      messages: [
        { role: 'system', content: '你是律师事务所的智能法律顾问。用专业、亲切的口吻回复客户，30字以内。' },
        { role: 'user', content: '我想问一下离婚需要什么手续？' },
      ],
      tenantId: 'integration-test',
    });

    expect(reply).toBeTruthy();
    expect(reply.length).toBeGreaterThan(10);
  }, 20000);

  it('LLM to TTS should produce audio file', async () => {
    const aiReply = '您好，感谢来电。劳动仲裁需要准备劳动合同、工资单等证据材料，建议您尽快到律所详细咨询。';

    const nlsKey = process.env.NLS_APP_KEY;
    if (!nlsKey) {
      console.warn('NLS_APP_KEY not configured, skipping TTS integration test');
      return;
    }

    const audioPath = await ttsService.synthesize(aiReply);

    expect(audioPath).toBeTruthy();
    const fs = require('fs');
    expect(fs.existsSync(audioPath)).toBe(true);
    const stats = fs.statSync(audioPath);
    expect(stats.size).toBeGreaterThan(0);
    console.log(`Integration test passed. Audio: ${audioPath} (${stats.size} bytes)`);
  }, 30000);
});
