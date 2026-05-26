import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './customer.entity';
import * as CryptoJS from 'crypto-js';

export interface CreateCustomerDto {
  name: string;
  phone: string;
  caseType?: string;
  source?: string;
  tags?: string[];
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
  ) {}

  // tenant 现在是租户ID字符串
  async create(tenantId: string, data: CreateCustomerDto) {
    const phoneEncrypted = this.encryptPhone(data.phone);
    
    // 查询时使用 tenantId
    const existing = await this.customerRepo.findOne({
      where: { tenantId: tenantId, phoneEncrypted } as any,
    });
    
    if (existing) {
      throw new BadRequestException('客户已存在');
    }

    // 创建时直接设置 tenantId
    const customer = this.customerRepo.create({
      tenantId: tenantId,
      name: data.name,
      phoneEncrypted,
      caseType: data.caseType,
      source: (data.source || 'import') as any,
      status: 'new',
      tags: data.tags || [],
    });

    return this.customerRepo.save(customer);
  }

  async batchCreate(tenantId: string, customers: CreateCustomerDto[]) {
    const results: Array<{ success: boolean; customer?: any; error?: string; data?: CreateCustomerDto }> = [];
    for (const data of customers) {
      try {
        const customer = await this.create(tenantId, data);
        results.push({ success: true, customer });
      } catch (e: any) {
        results.push({ success: false, error: e.message, data });
      }
    }
    return results;
  }

  async findAll(tenantId: string, filters?: {
    status?: string;
    caseType?: string;
    tag?: string;
    page?: number;
    limit?: number;
  }) {
    const query = this.customerRepo.createQueryBuilder('customer')
      .leftJoinAndSelect('customer.callLogs', 'callLogs')
      .where('customer.tenantId = :tenantId', { tenantId });

    if (filters?.status) {
      query.andWhere('customer.status = :status', { status: filters.status });
    }
    if (filters?.caseType) {
      query.andWhere('customer.caseType = :caseType', { caseType: filters.caseType });
    }
    if (filters?.tag) {
      query.andWhere('customer.tags LIKE :tag', { tag: `%${filters.tag}%` });
    }

    query.orderBy('customer.createdAt', 'DESC');

    if (filters?.page && filters?.limit) {
      query.skip((filters.page - 1) * filters.limit)
         .take(filters.limit);
    }

    return query.getManyAndCount();
  }

  async findOne(tenantId: string, id: string) {
    const customer = await this.customerRepo.findOne({
      where: { id, tenantId: tenantId } as any,
      relations: ['callLogs', 'wechatSessions'],
    });
    if (!customer) throw new NotFoundException('客户不存在');
    return customer;
  }

  async update(tenantId: string, id: string, data: Partial<Customer>) {
    await this.customerRepo.update({ id, tenantId: tenantId } as any, data);
    return this.findOne(tenantId, id);
  }

  async updateStatus(tenantId: string, id: string, status: Customer['status']) {
    return this.update(tenantId, id, { status });
  }

  async getDecryptedPhone(tenantId: string, customerId: string): Promise<string> {
    const customer = await this.findOne(tenantId, customerId);
    return this.decryptPhone(customer.phoneEncrypted);
  }

  private encryptPhone(phone: string): string {
    return CryptoJS.AES.encrypt(phone, 'legal-call-key').toString();
  }

  private decryptPhone(encrypted: string): string {
    const bytes = CryptoJS.AES.decrypt(encrypted, 'legal-call-key');
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}