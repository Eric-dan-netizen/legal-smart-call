import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { WechatService } from './wechat.service';
import { Tenant } from '../tenants/tenant.entity';
import { Customer } from '../customers/customer.entity';
import { CurrentTenant } from '../../decorators/current-tenant.decorator';

@Controller('wechat')
export class WechatController {
  constructor(private readonly wechatService: WechatService) {}

  /**
   * 添加客户微信（生成企微联系二维码）
   */
  @Post('add-customer')
  async addCustomerWechat(
    @CurrentTenant() tenant: Tenant,
    @Body() data: { customerId: string; agentUserId: string },
  ) {
    // 这里需要从 customer service 获取客户信息
    // 简化处理，实际应该注入 CustomersService
    const customer = { id: data.customerId, name: '客户' } as Customer;
    
    const result = await this.wechatService.addCustomerWechat(tenant, customer, data.agentUserId);
    
    return {
      success: true,
      message: '微信联系二维码生成成功',
      data: result,
    };
  }

  /**
   * 查询会话状态
   */
  @Get('session/:sessionId')
  getSessionStatus(@Param('sessionId') sessionId: string) {
    return this.wechatService.getSessionStatus(sessionId);
  }

  /**
   * 更新会话状态
   */
  @Patch('session/:sessionId')
  updateSessionStatus(
    @Param('sessionId') sessionId: string,
    @Body() data: { status: 'pending' | 'added' | 'chatting' | 'closed' },
  ) {
    return this.wechatService.updateSessionStatus(sessionId, data.status);
  }
}
