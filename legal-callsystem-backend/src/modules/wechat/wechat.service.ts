import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WechatSession } from './wechat-session.entity';
import { Customer } from '../customers/customer.entity';
import { Tenant } from '../tenants/tenant.entity';

/**
 * 企业微信集成服务
 * 文档：https://work.weixin.qq.com/api/doc
 */
@Injectable()
export class WechatService {
  private readonly logger = new Logger(WechatService.name);
  private corpId: string;
  private agentId: string;
  private secret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    private configService: ConfigService,
    @InjectRepository(WechatSession)
    private sessionRepo: Repository<WechatSession>,
  ) {
    this.corpId = this.configService.get<string>('WECHAT_CORP_ID') || '';
    this.agentId = this.configService.get<string>('WECHAT_AGENT_ID') || '';
    this.secret = this.configService.get<string>('WECHAT_SECRET') || '';
  }

  /**
   * 获取访问令牌
   */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const { default: axios } = await import('axios');
    
    try {
      const response = await axios.get(
        `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.corpId}&corpsecret=${this.secret}`
      );

      if (response.data.errcode === 0) {
        this.accessToken = response.data.access_token;
        this.tokenExpiresAt = Date.now() + (response.data.expires_in - 300) * 1000;
        return this.accessToken as string;
      } else {
        throw new Error(`企业微信 API 错误：${response.data.errmsg}`);
      }
    } catch (error) {
      this.logger.error(`获取 access_token 失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 添加客户微信
   */
  async addCustomerWechat(tenant: Tenant, customer: Customer, agentUserId: string) {
    const accessToken = await this.getAccessToken();
    const { default: axios } = await import('axios');

    try {
      const response = await axios.post(
        `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/add_contact_way?access_token=${accessToken}`,
        {
          type: 1,
          scene: 1,
          style: 1,
          remark: `客户：${customer.name}`,
          skip_verify: false,
          state: `customer_${customer.id}`,
          user: [agentUserId],
        }
      );

      if (response.data.errcode === 0) {
        // 创建会话记录
        const session = this.sessionRepo.create({
          tenant,
          customer,
          contactWayId: response.data.config_id,
          status: 'pending',
        });
        await this.sessionRepo.save(session);

        return {
          success: true,
          contactWayId: response.data.config_id,
          qrCodeUrl: `https://work.weixin.qq.com/kfid/kfcid_${response.data.config_id}`,
          session,
        };
      } else {
        throw new Error(`企业微信 API 错误：${response.data.errmsg}`);
      }
    } catch (error) {
      this.logger.error(`添加客户微信失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 查询会话状态
   */
  async getSessionStatus(sessionId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['customer'],
    });

    if (!session) {
      throw new Error('会话不存在');
    }

    return {
      sessionId: session.id,
      status: session.status,
      customerName: session.customer.name,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  /**
   * 更新会话状态
   */
  async updateSessionStatus(sessionId: string, status: WechatSession['status']) {
    await this.sessionRepo.update({ id: sessionId }, { status });
    return this.getSessionStatus(sessionId);
  }
}
