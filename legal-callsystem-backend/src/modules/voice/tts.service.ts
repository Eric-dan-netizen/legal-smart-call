import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import { AliyunSignatureService } from '../common/aliyun-signature.service';

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

  private readonly voices = {
    azure: {
      'zh-CN-Xiaoxiao Neural': '中文女声 - 清晰自然',
      'zh-CN-Yunxi Neural': '中文男声 - 成熟稳重',
      'zh-CN-Xiaoyi Neural': '中文女声 - 年轻活泼',
      'zh-CN-Yunjian Neural': '中文男声 - 阳光开朗',
    },
    aliyun: {
      xiaoyun: '中文女声 - 标准',
      xiaogang: '中文男声 - 标准',
      ruoxi: '中文女声 - 温柔',
      siqi: '中文女声 - 活泼',
      sijia: '中文女声 - 亲切',
      sicheng: '中文男声 - 成熟',
    },
  };

  constructor(
    private configService: ConfigService,
    private signService: AliyunSignatureService,
  ) {
    this.provider = this.configService.get<string>('TTS_PROVIDER', 'aliyun');
    this.azureKey = this.configService.get<string>('AZURE_SPEECH_KEY', '');
    this.azureRegion = this.configService.get<string>('AZURE_SPEECH_REGION', 'eastus');
  }

  async synthesize(text: string, options: TtsOptions = {}): Promise<string> {
    if (this.provider === 'azure' && this.azureKey) {
      return this.azureSynthesize(text, options);
    }
    if (this.provider === 'aliyun') {
      return this.aliyunSynthesize(text, options);
    }
    throw new Error(`TTS 服务商未配置或不支持: ${this.provider}`);
  }

  /**
   * 阿里云 NLS TTS REST API
   */
  private async aliyunSynthesize(text: string, options: TtsOptions): Promise<string> {
    const appKey = this.configService.get<string>('NLS_APP_KEY');
    if (!appKey) {
      throw new Error('NLS_APP_KEY 未配置，无法使用阿里云语音合成');
    }

    const voice = options.voice || 'xiaoyun';
    const maxLen = 300;
    const truncated = text.length > maxLen ? text.slice(0, maxLen) : text;

    if (text.length > maxLen) {
      this.logger.warn(`文本过长 (${text.length}字)，截断至 ${maxLen} 字`);
    }

    this.logger.log(`阿里云 TTS 合成：${truncated.slice(0, 50)}...`);

    try {
      const token = await this.getNlsToken();
      const params = new URLSearchParams({
        appkey: appKey,
        text: truncated,
        format: 'mp3',
        voice,
        sample_rate: '16000',
        volume: '50',
        speech_rate: '0',
        pitch_rate: '0',
      });

      const response = await axios.post(
        `https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/tts?${params.toString()}`,
        null,
        {
          headers: {
            'X-NLS-Token': token,
            'Content-Type': 'application/octet-stream',
          },
          timeout: 20000,
          responseType: 'arraybuffer',
        },
      );

      if (response.headers['content-type']?.includes('application/json')) {
        const errText = Buffer.from(response.data).toString();
        throw new Error(`TTS 返回错误: ${errText}`);
      }

      const filename = `tts_${Date.now()}.mp3`;
      const filepath = `/tmp/${filename}`;
      fs.writeFileSync(filepath, Buffer.from(response.data));

      this.logger.log(`TTS 音频已保存: ${filepath} (${response.data.length} bytes)`);
      return filepath;
    } catch (error) {
      this.logger.error(`阿里云 TTS 失败: ${error.message}`);
      throw error;
    }
  }

  private async azureSynthesize(text: string, options: TtsOptions): Promise<string> {
    const voice = options.voice || 'zh-CN-Xiaoxiao Neural';
    const style = options.style || 'cheerful';
    const rate = options.rate || '+0%';
    const pitch = options.pitch || '+0Hz';

    if (!this.azureKey) {
      throw new Error('Azure Speech Key 未配置');
    }

    try {
      const token = await this.getAzureToken();
      const ssml = this.buildSsml(text, voice, style, rate, pitch);

      const response = await axios.post(
        `https://${this.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
        ssml,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
          },
          responseType: 'arraybuffer',
          timeout: 20000,
        },
      );

      const filename = `tts_${Date.now()}.mp3`;
      const filepath = `/tmp/${filename}`;
      fs.writeFileSync(filepath, Buffer.from(response.data));
      return filepath;
    } catch (error) {
      this.logger.error(`Azure TTS 失败: ${error.message}`);
      throw error;
    }
  }

  private buildSsml(text: string, voice: string, style: string, rate: string, pitch: string): string {
    const escaped = text.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
    return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>
      <voice name='${voice}'>
        <mstts:express-as type='${style}'>
          <prosody rate='${rate}' pitch='${pitch}'>${escaped}</prosody>
        </mstts:express-as>
      </voice>
    </speak>`;
  }

  private async getAzureToken(): Promise<string> {
    const response = await axios.post(
      `https://${this.azureRegion}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`,
      null,
      { headers: { 'Ocp-Apim-Subscription-Key': this.azureKey }, timeout: 10000 },
    );
    return response.data;
  }

  private async getNlsToken(): Promise<string> {
    const params: Record<string, any> = {
      Action: 'CreateToken',
      Version: '2019-02-28',
      RegionId: 'cn-shanghai',
    };

    const signedQuery = this.signService.buildSignedQuery(params, 'POST');

    const response = await axios.post(
      'https://nls-meta.cn-shanghai.aliyuncs.com/pop/2018-05-18/token',
      null,
      {
        params: new URLSearchParams(signedQuery),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      },
    );

    if (response.data.Token?.Id) {
      return response.data.Token.Id;
    }
    throw new Error(`获取 NLS Token 失败: ${JSON.stringify(response.data)}`);
  }

  async getAudioDuration(audioPath: string): Promise<number> {
    try {
      const stats = fs.statSync(audioPath);
      return Math.max(Math.round(stats.size / 2000), 1);
    } catch {
      return 3;
    }
  }

  getVoices(provider = this.provider): Record<string, string> {
    return this.voices[provider] || {};
  }
}
