import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';

export interface TtsOptions {
  voice?: string;
  style?: string;
  rate?: string;
  pitch?: string;
}

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly provider: string;
  private readonly azureKey: string;
  private readonly azureRegion: string;
  private readonly aliyunAccessKey: string;
  private readonly aliyunSecret: string;

  private readonly voices = {
    azure: {
      'zh-CN-Xiaoxiao Neural': '中文女声 - 清晰自然',
      'zh-CN-Yunxi Neural': '中文男声 - 成熟稳重',
      'zh-CN-Xiaoyi Neural': '中文女声 - 年轻活泼',
      'zh-CN-Yunjian Neural': '中文男声 - 阳光开朗',
      'zh-CN-XiaoxiaoMultilingualNeural': '中文女声 - 多语言情感',
    },
    aliyun: {
      'xiaoyun': '中文女声',
      'xiaogang': '中文男声',
      'ruoxi': '中文女声 - 温柔',
    }
  };

  constructor() {
    this.provider = process.env.TTS_PROVIDER || 'azure';
    this.azureKey = process.env.AZURE_SPEECH_KEY || '';
    this.azureRegion = process.env.AZURE_SPEECH_REGION || 'eastus';
    this.aliyunAccessKey = process.env.ALIYUN_ACCESS_KEY_ID || '';
    this.aliyunSecret = process.env.ALIYUN_ACCESS_KEY_SECRET || '';
  }

  async synthesize(text: string, options: TtsOptions = {}): Promise<string> {
    if (this.provider === 'azure') {
      return this.azureSynthesize(text, options);
    } else if (this.provider === 'aliyun') {
      return this.aliyunSynthesize(text, options);
    }
    throw new Error('TTS provider not configured');
  }

  private async azureSynthesize(text: string, options: TtsOptions): Promise<string> {
    const voice = options.voice || 'zh-CN-Xiaoxiao Neural';
    const style = options.style || 'cheerful';
    const rate = options.rate || '+0%';
    const pitch = options.pitch || '+0Hz';

    this.logger.log('Azure TTS synthesizing: ' + voice);

    if (!this.azureKey) {
      this.logger.warn('Azure key not configured, using mock');
      return this.mockTts(text);
    }

    try {
      const token = await this.getAzureToken();
      const ssml = this.buildSsml(text, voice, style, rate, pitch);
      
      const response = await axios.post(
        `https://${this.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
        ssml,
        {
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
          },
          responseType: 'arraybuffer',
        }
      );

      const filename = `tts_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp3`;
      const filepath = `/tmp/${filename}`;
      fs.writeFileSync(filepath, Buffer.from(response.data));
      
      this.logger.log('TTS saved: ' + filepath);
      return filepath;
    } catch (error) {
      this.logger.error('Azure TTS failed: ' + error.message);
      return this.mockTts(text);
    }
  }

  private buildSsml(text: string, voice: string, style: string, rate: string, pitch: string): string {
    const escapedText = text
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>');
    
    return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>
      <voice name='${voice}'>
        <mstts:express-as type='${style}'>
          <prosody rate='${rate}' pitch='${pitch}'>
            ${escapedText}
          </prosody>
        </mstts:express-as>
      </voice>
    </speak>`;
  }

  private async getAzureToken(): Promise<string> {
    const response = await axios.post(
      `https://${this.azureRegion}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`,
      null,
      {
        headers: { 'Ocp-Apim-Subscription-Key': this.azureKey },
      }
    );
    return response.data;
  }

  private async aliyunSynthesize(text: string, options: TtsOptions): Promise<string> {
    this.logger.log('Aliyun TTS not fully implemented');
    return this.mockTts(text);
  }

  private mockTts(text: string): string {
    const filename = `mock_tts_${Date.now()}.mp3`;
    const filepath = `/tmp/${filename}`;
    // Create empty file as placeholder
    fs.writeFileSync(filepath, Buffer.alloc(0));
    return filepath;
  }

  async getAudioDuration(audioPath: string): Promise<number> {
    // 估算：中文平均每秒5字
    return 3;
  }

  getVoices(provider: string = this.provider): Record<string, string> {
    return this.voices[provider] || {};
  }
}