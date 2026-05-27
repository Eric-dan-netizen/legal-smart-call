import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AliyunSignatureService } from '../common/aliyun-signature.service';

export interface AsrResult {
  text: string;
  confidence: number;
  duration: number;
}

@Injectable()
export class AsrService {
  private readonly logger = new Logger(AsrService.name);
  private readonly provider: string;
  private readonly appKey: string;
  private readonly endpoint = 'https://nls-meta.cn-shanghai.aliyuncs.com';

  constructor(
    private configService: ConfigService,
    private signService: AliyunSignatureService,
  ) {
    this.provider = this.configService.get<string>('ASR_PROVIDER', 'aliyun');
    this.appKey = this.configService.get<string>('NLS_APP_KEY', '');
  }

  async recognize(audioBuffer: Buffer): Promise<AsrResult> {
    if (this.provider === 'aliyun') {
      return this.aliyunRecognize(audioBuffer);
    }
    throw new Error(`不支持的 ASR 服务商: ${this.provider}`);
  }

  /**
   * 阿里云 NLS 一句话识别
   * 文档: https://help.aliyun.com/zh/nls/sentence-recognizer
   */
  private async aliyunRecognize(audioBuffer: Buffer): Promise<AsrResult> {
    if (!this.appKey) {
      throw new Error('NLS_APP_KEY 未配置，无法使用阿里云语音识别');
    }

    this.logger.log(`阿里云 NLS 识别，音频大小: ${audioBuffer.length} bytes`);

    try {
      // Token-based auth for NLS REST API
      const token = await this.getNlsToken();
      const url = `https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr`;
      const params = new URLSearchParams({
        appkey: this.appKey,
        format: 'pcm',
        sample_rate: '16000',
        enable_punctuation_prediction: 'true',
        enable_inverse_text_normalization: 'true',
      });

      const response = await axios.post(`${url}?${params.toString()}`, audioBuffer, {
        headers: {
          'X-NLS-Token': token,
          'Content-Type': 'application/octet-stream',
        },
        timeout: 15000,
        responseType: 'json',
      });

      const data = response.data;
      if (data.status !== 200) {
        throw new Error(`NLS 识别失败: ${data.error_msg || data.status}`);
      }

      const text = data.result || '';
      this.logger.log(`NLS 识别结果: ${text}`);

      return {
        text,
        confidence: data.confidence || 0.9,
        duration: audioBuffer.length / 32000, // 16kHz 16bit mono = 32000 bytes/s
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('NLS')) {
        throw error;
      }
      this.logger.error(`NLS 识别失败: ${error.message}`);
      throw new Error(`ASR 识别失败: ${error.message}`);
    }
  }

  /**
   * 获取 NLS Token（HMAC-SHA1 签名）
   */
  private async getNlsToken(): Promise<string> {
    const params: Record<string, any> = {
      Action: 'CreateToken',
      Version: '2019-02-28',
      RegionId: 'cn-shanghai',
    };

    const signedQuery = this.signService.buildSignedQuery(params, 'POST');
    const url = `${this.endpoint}/pop/2018-05-18/token`;

    try {
      const response = await axios.post(url, null, {
        params: new URLSearchParams(signedQuery),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      });

      if (response.data.Token?.Id) {
        return response.data.Token.Id;
      }
      throw new Error(`获取 NLS Token 失败: ${JSON.stringify(response.data)}`);
    } catch (error) {
      this.logger.error(`获取 NLS Token 失败: ${error.message}`);
      throw error;
    }
  }

  async recognizeFile(audioUrl: string): Promise<AsrResult> {
    this.logger.log(`识别音频文件: ${audioUrl}`);

    try {
      const response = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      return this.recognize(Buffer.from(response.data));
    } catch (error) {
      this.logger.error(`下载音频文件失败: ${error.message}`);
      throw new Error(`无法获取音频文件: ${error.message}`);
    }
  }
}
