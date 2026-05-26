import { Injectable } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';

/**
 * TTS 语音合成服务
 * 支持阿里云、Azure 等服务商
 */
@Injectable()
export class TtsService {
  private readonly provider: string;
  private readonly apiKey: string;

  constructor() {
    this.provider = process.env.TTS_PROVIDER || 'aliyun';
    this.apiKey = process.env.TTS_API_KEY || '';
  }

  /**
   * 文本转语音
   * @param text 要合成的文本
   * @param voice 音色（可选）
   */
  async synthesize(text: string, voice: string = 'xiaoyun'): Promise<string> {
    if (this.provider === 'aliyun') {
      return this.aliyunSynthesize(text, voice);
    } else if (this.provider === 'azure') {
      return this.azureSynthesize(text, voice);
    } else {
      throw new Error(`不支持的 TTS 服务商：${this.provider}`);
    }
  }

  /**
   * 阿里云智能语音合成
   * 文档：https://help.aliyun.com/product/30413.html
   */
  private async aliyunSynthesize(text: string, voice: string): Promise<string> {
    // 实际需调用阿里云 NUI 服务
    console.log('阿里云 TTS 合成:', { text, voice });

    // 模拟返回 OSS URL
    return `https://oss.example.com/tts/${this.hash(text)}.mp3`;
  }

  /**
   * Azure TTS 合成
   * 文档：https://learn.microsoft.com/zh-cn/azure/ai-services/speech-service/
   */
  private async azureSynthesize(text: string, voice: string): Promise<string> {
    console.log('Azure TTS 合成:', { text, voice });
    return `https://storage.example.com/tts/${this.hash(text)}.mp3`;
  }

  private hash(text: string): string {
    return CryptoJS.MD5(text).toString().substring(0, 8);
  }
}

/**
 * OSS 文件上传服务
 */
@Injectable()
export class OssService {
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKey: string;
  private readonly secretKey: string;

  constructor() {
    this.bucket = process.env.ALIYUN_OSS_BUCKET || '';
    this.region = process.env.ALIYUN_OSS_REGION || '';
    this.accessKey = process.env.ALIYUN_OSS_ACCESS_KEY || '';
    this.secretKey = process.env.ALIYUN_OSS_SECRET_KEY || '';
  }

  /**
   * 上传文件
   * @param file 文件 Buffer
   * @param filename 文件名
   */
  async upload(file: Buffer, filename: string): Promise<string> {
    console.log('上传文件到 OSS:', filename);
    
    // 实际需使用阿里云 OSS SDK
    // const client = new OSS({ region: this.region, bucket: this.bucket, ... });
    // await client.put(filename, file);
    
    return `https://${this.bucket}.oss-${this.region}.aliyuncs.com/${filename}`;
  }

  /**
   * 上传录音文件
   */
  async uploadRecording(file: Buffer, tenantId: string, callId: string): Promise<string> {
    const filename = `recordings/${tenantId}/${callId}.mp3`;
    return this.upload(file, filename);
  }

  /**
   * 上传话术录音
   */
  async uploadScript(file: Buffer, tenantId: string, scriptName: string): Promise<string> {
    const filename = `scripts/${tenantId}/${scriptName}.mp3`;
    return this.upload(file, filename);
  }
}
