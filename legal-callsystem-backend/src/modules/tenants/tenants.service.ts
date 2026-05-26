import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
  ) {}

  async create(data: { name: string; dailyCallLimit?: number }) {
    const tenant = this.tenantRepo.create({
      name: data.name,
      licenseKey: this.generateLicenseKey(),
      dailyCallLimit: data.dailyCallLimit || 50,
      status: 'active',
    });
    return this.tenantRepo.save(tenant);
  }

  async findAll() {
    return this.tenantRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException('租户不存在');
    return tenant;
  }

  async update(id: string, data: Partial<Tenant>) {
    await this.tenantRepo.update(id, data);
    return this.findOne(id);
  }

  async updateStatus(id: string, status: 'active' | 'suspended' | 'expired') {
    return this.update(id, { status });
  }

  async findByLicenseKey(licenseKey: string) {
    return this.tenantRepo.findOne({ where: { licenseKey } });
  }

  async findByName(name: string) {
    return this.tenantRepo.findOne({ where: { name } });
  }

  async findOrCreate(name: string) {
    let tenant = await this.findByName(name);
    if (!tenant) {
      tenant = await this.create({ name });
    }
    return tenant;
  }

  private generateLicenseKey(): string {
    return 'LC-' + randomUUID().substring(0, 8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
  }
}
