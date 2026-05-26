import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Script } from './script.entity';
import { Tenant } from '../tenants/tenant.entity';

@Injectable()
export class ScriptsService {
  constructor(
    @InjectRepository(Script)
    private scriptRepo: Repository<Script>,
  ) {}

  async create(tenant: Tenant, data: CreateScriptDto) {
    const script = this.scriptRepo.create({
      tenant,
      name: data.name,
      // 兼容 textContent 和 content 两种字段名
      textContent: data.textContent || data.content || '',
      type: (data.type as any) || 'general',
    });
    return this.scriptRepo.save(script);
  }

  async findAll(tenant: Tenant | string, filters?: { type?: string; tag?: string }) {
    // 兼容 Tenant 对象和 tenantId 字符串
    const tenantId = typeof tenant === 'string' ? tenant : (tenant as Tenant).id;
    const query = this.scriptRepo.createQueryBuilder('script')
      .where('script.tenantId = :tenantId', { tenantId });

    if (filters?.type) {
      query.andWhere('script.type = :type', { type: filters.type });
    }
    if (filters?.tag) {
      query.andWhere('script.tags @> :tag', { tag: [filters.tag] });
    }

    return query.getMany();
  }

  async findOne(tenant: Tenant, id: string) {
    const script = await this.scriptRepo.findOne({
      where: { id, tenant: { id: tenant.id } },
    });
    if (!script) throw new NotFoundException('话术不存在');
    return script;
  }

  async update(tenant: Tenant, id: string, data: Partial<Script>) {
    await this.scriptRepo.update({ id, tenant: { id: tenant.id } }, data);
    return this.findOne(tenant, id);
  }

  async delete(tenant: Tenant, id: string) {
    await this.scriptRepo.delete({ id, tenant: { id: tenant.id } });
    return { success: true };
  }
}

export interface CreateScriptDto {
  name: string;
  textContent?: string;
  content?: string;
  type?: 'general' | 'opening' | 'objection' | 'closing';
  tags?: string[];
  isActive?: boolean;
}
