import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class AliyunSignatureService {
  private readonly logger = new Logger(AliyunSignatureService.name);

  private readonly accessKeyId: string;
  private readonly accessKeySecret: string;

  constructor(private configService: ConfigService) {
    this.accessKeyId = this.configService.get<string>('ALIYUN_ACCESS_KEY_ID') || '';
    this.accessKeySecret = this.configService.get<string>('ALIYUN_ACCESS_KEY_SECRET') || '';
  }

  /**
   * 构建已签名的公共参数
   * @param actionParams 业务参数（Action, 等）
   * @param httpMethod GET 或 POST
   * @returns 已排序的完整 query string（含 Signature）
   */
  buildSignedQuery(
    actionParams: Record<string, any>,
    httpMethod: 'GET' | 'POST' = 'GET',
  ): string {
    const systemParams: Record<string, any> = {
      Format: 'JSON',
      Version: actionParams.Version || '2019-08-23',
      AccessKeyId: this.accessKeyId,
      SignatureMethod: 'HMAC-SHA1',
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      SignatureVersion: '1.0',
      SignatureNonce: this.generateNonce(),
      RegionId: 'cn-shanghai',
    };

    const allParams = { ...systemParams, ...actionParams };

    const sortedKeys = Object.keys(allParams).sort();
    const canonicalQuery = sortedKeys
      .map(key => `${this.percentEncode(key)}=${this.percentEncode(String(allParams[key]))}`)
      .join('&');

    const stringToSign = `${httpMethod}&${this.percentEncode('/')}&${this.percentEncode(canonicalQuery)}`;
    const signature = CryptoJS.HmacSHA1(stringToSign, `${this.accessKeySecret}&`)
      .toString(CryptoJS.enc.Base64);

    const signedQuery = sortedKeys
      .map(key => `${this.percentEncode(key)}=${this.percentEncode(String(allParams[key]))}`)
      .join('&');

    return `${signedQuery}&${this.percentEncode('Signature')}=${this.percentEncode(signature)}`;
  }

  percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/\+/g, '%20')
      .replace(/\*/g, '%2A')
      .replace(/%7E/g, '~');
  }

  generateNonce(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}
