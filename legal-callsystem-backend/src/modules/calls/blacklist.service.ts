import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blacklist } from './blacklist.entity';
import * as crypto from 'crypto';

export interface AddBlacklistDto {
  phone: string;
  reason?: string;
}

@Injectable()
export class BlacklistService {
  constructor(
    @InjectRepository(Blacklist)
    private blacklistRepo: Repository<Blacklist>,
  ) {}

  private hashPhone(phone: string): string {
    return crypto.createHash('sha256').update(phone).digest('hex');
  }

  async add(tenantId: string, data: AddBlacklistDto) {
    const phoneHash = this.hashPhone(data.phone);

    const existing = await this.blacklistRepo.findOne({
      where: { tenantId, phoneHash } as any,
    });
    if (existing) {
      throw new BadRequestException('该号码已在黑名单中');
    }

    const entry = this.blacklistRepo.create({
      tenantId,
      phoneHash,
      reason: data.reason || '手动添加',
    });

    return this.blacklistRepo.save(entry);
  }

  async batchAdd(tenantId: string, items: AddBlacklistDto[]) {
    const results: Array<{ success: boolean; phone: string; error?: string }> = [];
    for (const item of items) {
      try {
        await this.add(tenantId, item);
        results.push({ success: true, phone: item.phone });
      } catch (e: any) {
        results.push({ success: false, phone: item.phone, error: e.message });
      }
    }
    return results;
  }

  async isBlacklisted(tenantId: string, phone: string): Promise<boolean> {
    const phoneHash = this.hashPhone(phone);
    const entry = await this.blacklistRepo.findOne({
      where: { tenantId, phoneHash } as any,
    });
    return !!entry;
  }

  async remove(tenantId: string, phone: string) {
    const phoneHash = this.hashPhone(phone);
    const result = await this.blacklistRepo.delete({
      tenantId, phoneHash,
    } as any);
    if (result.affected === 0) {
      throw new BadRequestException('该号码不在黑名单中');
    }
    return { removed: true, phone };
  }

  async findAll(tenantId: string, page = 1, limit = 20) {
    const [items, total] = await this.blacklistRepo.findAndCount({
      where: { tenantId } as any,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }
}
