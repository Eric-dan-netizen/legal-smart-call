import { Controller, Get, Post, Body, Param, Patch, Delete, Query } from '@nestjs/common';
import { ScriptsService, CreateScriptDto } from './scripts.service';
import { Tenant } from '../tenants/tenant.entity';
import { CurrentTenant } from '../../decorators/current-tenant.decorator';

@Controller('scripts')
export class ScriptsController {
  constructor(private readonly scriptsService: ScriptsService) {}

  @Post()
  create(@CurrentTenant() tenant: Tenant, @Body() data: CreateScriptDto) {
    return this.scriptsService.create(tenant, data);
  }

  @Get()
  findAll(
    @CurrentTenant() tenant: Tenant,
    @Query() filters: { type?: string; tag?: string },
  ) {
    return this.scriptsService.findAll(tenant, filters);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenant: Tenant, @Param('id') id: string) {
    return this.scriptsService.findOne(tenant, id);
  }

  @Patch(':id')
  update(@CurrentTenant() tenant: Tenant, @Param('id') id: string, @Body() data: Partial<CreateScriptDto>) {
    return this.scriptsService.update(tenant, id, data);
  }

  @Delete(':id')
  delete(@CurrentTenant() tenant: Tenant, @Param('id') id: string) {
    return this.scriptsService.delete(tenant, id);
  }
}
