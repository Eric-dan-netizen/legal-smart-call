import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../modules/tenants/tenant.entity';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const licenseKey = request.headers['x-tenant-key'] as string;

    if (!licenseKey) {
      throw new ForbiddenException('缺少租户标识');
    }

    const tenant = await this.tenantRepo.findOne({
      where: { licenseKey },
    });

    if (!tenant) {
      throw new ForbiddenException('无效的租户标识');
    }

    if (tenant.status !== 'active') {
      throw new ForbiddenException('租户已停用');
    }

    request['tenant'] = tenant;
    return true;
  }
}
