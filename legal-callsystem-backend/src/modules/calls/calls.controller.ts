import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CallsService, CreateTaskDto } from './calls.service';
import { AliyunCallService } from './aliyun-call.service';
import { Tenant } from '../tenants/tenant.entity';
import { CurrentTenant } from '../../decorators/current-tenant.decorator';

@Controller('calls')
export class CallsController {
  constructor(
    private readonly callsService: CallsService,
    private readonly aliyunCallService: AliyunCallService,
  ) {}

  @Post('tasks')
  createTask(@CurrentTenant() tenant: any, @Body() data: CreateTaskDto) {
    return this.callsService.createTask(tenant, data);
  }

  @Get('tasks')
  findAllTasks(
    @CurrentTenant() tenant: any,
    @Query() filters: { status?: string; page?: number; limit?: number },
  ) {
    return this.callsService.findAllTasks(tenant, filters);
  }

  @Get('tasks/:id')
  getTask(@CurrentTenant() tenant: any, @Param('id') id: string) {
    return this.callsService.getTask(tenant, id);
  }

  @Post('tasks/:id/start')
  startTask(@CurrentTenant() tenant: any, @Param('id') id: string) {
    return this.callsService.startTask(tenant, id);
  }

  @Post('tasks/:id/pause')
  pauseTask(@CurrentTenant() tenant: any, @Param('id') id: string) {
    return this.callsService.pauseTask(tenant, id);
  }

  @Post('tasks/:id/cancel')
  cancelTask(@CurrentTenant() tenant: any, @Param('id') id: string) {
    return this.callsService.cancelTask(tenant, id);
  }

  @Get('logs')
  getCallLogs(
    @CurrentTenant() tenant: any,
    @Query() filters: { customerId?: string; status?: string; page?: number; limit?: number },
  ) {
    return this.callsService.getCallLogs(tenant, filters);
  }

  /**
   * 设置坐席号码（你的手机号）
   */
  @Post('agent-number')
  setAgentNumber(
    @CurrentTenant() tenant: any,
    @Body() data: { agentNumber: string },
  ) {
    return this.callsService.setAgentNumber(tenant, data.agentNumber);
  }

  /**
   * 获取坐席号码
   */
  @Get('agent-number')
  getAgentNumber(@CurrentTenant() tenant: any) {
    const agentNumber = tenant.config?.agentNumber || null;
    return { agentNumber };
  }

  /**
   * 测试外呼接口（直接调用阿里云 API）
   */
  @Post('test-call')
  async testCall(
    @CurrentTenant() tenant: any,
    @Body() data: { calledNumber: string; agentNumber: string; scriptId?: string },
  ) {
    const { calledNumber, agentNumber, scriptId } = data;
    
    if (!calledNumber || !agentNumber) {
      throw new Error('缺少必要参数：calledNumber 和 agentNumber');
    }

    const result = await this.aliyunCallService.makeCall(
      calledNumber,
      agentNumber,
      scriptId,
      `test_${Date.now()}`,
    );

    return {
      success: true,
      message: '外呼发起成功',
      data: result,
    };
  }

  /**
   * 查询通话状态
   */
  @Get('status/:callId')
  async getCallStatus(
    @CurrentTenant() tenant: any,
    @Param('callId') callId: string,
    @Query('date') date?: string,
  ) {
    const result = await this.aliyunCallService.getCallStatus(callId, date);
    
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 获取录音下载链接
   */
  @Get('recording/:callId')
  async getRecordingUrl(
    @CurrentTenant() tenant: any,
    @Param('callId') callId: string,
    @Query('date') date?: string,
  ) {
    const result = await this.aliyunCallService.getRecordingUrl(callId, date);
    
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 通话状态回调（阿里云回调通知）
   */
  @Post('callback')
  async handleCallback(@Body() data: any) {
    // 阿里云会推送通话状态和录音等回调
    // https://help.aliyun.com/document_detail/120632.html
    const { callId, status, duration, recordingUrl } = data;
    
    await this.callsService.updateCallLog(callId, {
      callStatus: status,
      duration: duration || 0,
      recordingUrl: recordingUrl || null,
    });

    return { success: true };
  }
}