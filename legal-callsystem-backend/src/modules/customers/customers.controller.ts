import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CustomersService, CreateCustomerDto } from './customers.service';
import { Tenant } from '../tenants/tenant.entity';
import { CurrentTenant } from '../../decorators/current-tenant.decorator';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  create(@CurrentTenant() tenant: any, @Body() data: CreateCustomerDto) {
    return this.customersService.create(tenant, data);
  }

  @Post('batch')
  batchCreate(@CurrentTenant() tenant: any, @Body() data: { customers: CreateCustomerDto[] }) {
    return this.customersService.batchCreate(tenant, data.customers);
  }

  @Get()
  findAll(
    @CurrentTenant() tenant: any,
    @Query() filters: { status?: string; caseType?: string; tag?: string; page?: number; limit?: number },
  ) {
    return this.customersService.findAll(tenant, filters);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenant: any, @Param('id') id: string) {
    return this.customersService.findOne(tenant, id);
  }

  @Patch(':id')
  update(@CurrentTenant() tenant: any, @Param('id') id: string, @Body() data: Partial<CreateCustomerDto>) {
    return this.customersService.update(tenant, id, data as any);
  }

  @Patch(':id/status')
  updateStatus(@CurrentTenant() tenant: any, @Param('id') id: string, @Body() data: { 
    status: 'new' | 'contacted' | 'interested' | 'wechat_added' | 'appointed' | 'closed' | 'rejected' 
  }) {
    return this.customersService.updateStatus(tenant, id, data.status);
  }
}
