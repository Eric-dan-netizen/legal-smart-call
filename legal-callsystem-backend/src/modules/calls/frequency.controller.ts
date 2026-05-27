import { Controller, Get, Param } from '@nestjs/common';
import { CallFrequencyService } from './call-frequency.service';
import { CurrentTenant } from '../../decorators/current-tenant.decorator';

@Controller('call-frequency')
export class FrequencyController {
  constructor(private readonly frequencyService: CallFrequencyService) {}

  @Get('check/:phone')
  check(@CurrentTenant() tenant: any, @Param('phone') phone: string) {
    return this.frequencyService.canCall(tenant, phone);
  }

  @Get('history/:phone')
  history(@CurrentTenant() tenant: any, @Param('phone') phone: string) {
    return this.frequencyService.getHistory(tenant, phone);
  }

  @Get('stats')
  stats(@CurrentTenant() tenant: any) {
    return this.frequencyService.getStats(tenant);
  }
}
