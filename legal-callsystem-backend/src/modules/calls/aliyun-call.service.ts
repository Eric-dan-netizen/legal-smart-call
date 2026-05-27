import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AliyunSignatureService } from '../common/aliyun-signature.service';

/**
 * 阿里云语音服务对接
 * 文档：https://help.aliyun.com/product/37856.html
 * 
 * 核心 API：
 * - DoublePlay: 发起双呼（先呼坐席，再呼客户）
 * - QueryCallDetail: 查询通话详情
 * - GetRecordingDownloadLink: 获取录音下载链接
 */
@Injectable()
export class AliyunCallService {
  private readonly logger = new Logger(AliyunCallService.name);
  
  private accessKeyId: string;
  private accessKeySecret: string;
  private appKey: string;
  private callNumber: string;
  private ossBucket: string;
  private ossRegion: string;

  // 阿里云 API 端点
  private readonly apiEndpoint = 'https://dyvmsapi.aliyuncs.com/';
  private readonly apiVersion = '2017-05-25';

  constructor(
    private configService: ConfigService,
    private signService: AliyunSignatureService,
  ) {
    this.accessKeyId = this.configService.get<string>('ALIYUN_ACCESS_KEY_ID') || '';
    this.accessKeySecret = this.configService.get<string>('ALIYUN_ACCESS_KEY_SECRET') || '';
    this.appKey = this.configService.get<string>('ALIYUN_CALL_APP_KEY') || '';
    this.callNumber = this.configService.get<string>('ALIYUN_CALL_NUMBER') || '';
    this.ossBucket = this.configService.get<string>('ALIYUN_OSS_BUCKET') || '';
    this.ossRegion = this.configService.get<string>('ALIYUN_OSS_REGION') || 'cn-hangzhou';

    this.logger.log(`阿里云服务初始化完成 - AppKey: ${this.appKey}, 外呼号码：${this.callNumber || '未配置'}`);
  }

  /**
   * 发起外呼（双呼模式）
   * @param calledNumber 被叫号码（客户）
   * @param agentNumber 坐席号码（律所）
   * @param scriptId 话术 ID
   * @param customerId 客户 ID（用于回调关联）
   */
  async makeCall(
    calledNumber: string,
    agentNumber: string,
    scriptId?: string,
    customerId?: string,
  ) {
    if (!this.accessKeyId || !this.accessKeySecret) {
      throw new Error('阿里云 API 密钥未配置');
    }

    const outId = customerId || `call_${Date.now()}`;
    
    // 双呼参数：先呼坐席，坐席接听后再呼客户
    const params: Record<string, any> = {
      Action: 'DoublePlay',
      Version: this.apiVersion,
      RegionId: 'cn-hangzhou',
      CalledShowNumber: this.callNumber,
      CalledNumber: calledNumber,
      AgentNumber: agentNumber,
      OutId: outId,
    };

    if (scriptId) {
      params.PlayId = scriptId;
    }

    try {
      this.logger.log(`发起外呼：${calledNumber} (客户) <- ${agentNumber} (坐席), OutId: ${outId}`);
      
      // 调用阿里云 API
      const response = await this.callApi(params);
      
      this.logger.log(`外呼发起成功：${JSON.stringify(response)}`);
      
      return {
        success: true,
        callId: outId,
        requestId: response.RequestId,
        status: 'initiated',
        calledNumber,
        agentNumber,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`外呼发起失败：${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 查询通话状态
   * @param callId 通话 ID（OutId）
   * @param date 通话日期（YYYYMMDD）
   */
  async getCallStatus(callId: string, date?: string) {
    const queryDate = date || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    const params: Record<string, any> = {
      Action: 'QueryCallDetail',
      Version: this.apiVersion,
      RegionId: 'cn-hangzhou',
      QueryId: callId,
      Date: queryDate,
    };

    try {
      const response = await this.callApi(params);
      
      return {
        success: true,
        callId,
        status: this.parseCallStatus(response),
        duration: response.CallDuration || 0,
        recordingUrl: response.RecordingUrl || null,
        calledNumber: response.CalledNumber,
        callerNumber: response.CallerNumber,
        startTime: response.CallTime,
      };
    } catch (error) {
      this.logger.error(`查询通话状态失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 获取录音下载链接
   * @param callId 通话 ID
   * @param date 通话日期
   */
  async getRecordingUrl(callId: string, date?: string) {
    const queryDate = date || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    const params: Record<string, any> = {
      Action: 'GetRecordingDownloadLink',
      Version: this.apiVersion,
      RegionId: 'cn-hangzhou',
      QueryId: callId,
      Date: queryDate,
    };

    try {
      const response = await this.callApi(params);
      
      return {
        success: true,
        callId,
        recordingUrl: response.DownloadUrl,
        expireTime: response.ExpireTime,
      };
    } catch (error) {
      this.logger.error(`获取录音链接失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 调用阿里云 API
   */
  private async callApi(params: Record<string, any>): Promise<any> {
    const { default: axios } = await import('axios');

    const signedQuery = this.signService.buildSignedQuery(params, 'GET');
    const url = `${this.apiEndpoint}?${signedQuery}`;

    try {
      const response = await axios.get(url, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      });

      if (response.data.Code === 'OK' || response.data.Code === 'ok') {
        return response.data;
      }
      throw new Error(`阿里云 API 错误：${response.data.Message || response.data.Code}`);
    } catch (error) {
      if (error.response?.data) {
        throw new Error(`阿里云 API 错误：${error.response.data.Message || error.response.data.Code}`);
      }
      throw error;
    }
  }

  /**
   * 生成签名
   */
  /**
   * 解析通话状态
   */
  private parseCallStatus(response: any): string {
    const callStatus = response.CallStatus;
    
    // 阿里云通话状态映射
    const statusMap: Record<string, string> = {
      '0': 'initiated',      // 已发起
      '1': 'calling',        // 呼叫中
      '2': 'answered',       // 已接听
      '3': 'completed',      // 已完成
      '4': 'busy',           // 忙线
      '5': 'no_answer',      // 未接听
      '6': 'shutdown',       // 关机
      '7': 'empty_number',   // 空号
      '8': 'failed',         // 呼叫失败
    };
    
    return statusMap[callStatus] || 'unknown';
  }
}

/**
 * 腾讯云呼叫中心对接（备用）
 * 文档：https://cloud.tencent.com/product/ccc
 */
@Injectable()
export class TencentCallService {
  private readonly logger = new Logger(TencentCallService.name);
  
  private secretId: string;
  private secretKey: string;
  private sdkAppId: string;

  constructor(private configService: ConfigService) {
    this.secretId = this.configService.get<string>('TENCENT_SECRET_ID') || '';
    this.secretKey = this.configService.get<string>('TENCENT_SECRET_KEY') || '';
    this.sdkAppId = this.configService.get<string>('TENCENT_SDK_APP_ID') || '';
  }

  async makeCall(calledNumber: string, scriptId: string, customerId: string) {
    this.logger.log(`腾讯云外呼：${calledNumber}, ScriptId: ${scriptId}`);
    
    // TODO: 实现腾讯云 SDK 调用
    return {
      callId: `tx_${Date.now()}`,
      status: 'initiated',
    };
  }
}
