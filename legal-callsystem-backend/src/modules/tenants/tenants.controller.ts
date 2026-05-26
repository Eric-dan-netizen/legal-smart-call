import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { Tenant } from './tenant.entity';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  create(@Body() data: { name: string; dailyCallLimit?: number }) {
    return this.tenantsService.create(data);
  }

  @Get()
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: Partial<Tenant>) {
    return this.tenantsService.update(id, data);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() data: { status: 'active' | 'suspended' | 'expired' }) {
    return this.tenantsService.updateStatus(id, data.status);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tenantsService.updateStatus(id, 'expired');
  }
}
