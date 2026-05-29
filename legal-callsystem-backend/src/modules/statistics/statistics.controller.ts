import { Controller, Get, Query } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { CurrentTenant } from '../../decorators/current-tenant.decorator';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statsService: StatisticsService) {}

  @Get('overview')
  getOverview(@CurrentTenant() tenant: any) {
    return this.statsService.getOverview(tenant.id);
  }

  @Get('trend')
  getTrend(@CurrentTenant() tenant: any, @Query('days') days?: number) {
    return this.statsService.getTrend(tenant.id, days || 7);
  }
}
