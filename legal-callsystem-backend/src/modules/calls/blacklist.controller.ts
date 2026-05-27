import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { BlacklistService, AddBlacklistDto } from './blacklist.service';
import { CurrentTenant } from '../../decorators/current-tenant.decorator';

@Controller('blacklist')
export class BlacklistController {
  constructor(private readonly blacklistService: BlacklistService) {}

  @Post()
  add(@CurrentTenant() tenant: any, @Body() data: AddBlacklistDto) {
    return this.blacklistService.add(tenant, data);
  }

  @Post('batch')
  batchAdd(@CurrentTenant() tenant: any, @Body() data: { items: AddBlacklistDto[] }) {
    return this.blacklistService.batchAdd(tenant, data.items);
  }

  @Get()
  findAll(
    @CurrentTenant() tenant: any,
    @Query() query: { page?: number; limit?: number },
  ) {
    return this.blacklistService.findAll(tenant, query.page || 1, query.limit || 20);
  }

  @Get('check/:phone')
  check(@CurrentTenant() tenant: any, @Param('phone') phone: string) {
    return this.blacklistService.isBlacklisted(tenant, phone);
  }

  @Delete(':phone')
  remove(@CurrentTenant() tenant: any, @Param('phone') phone: string) {
    return this.blacklistService.remove(tenant, phone);
  }
}
