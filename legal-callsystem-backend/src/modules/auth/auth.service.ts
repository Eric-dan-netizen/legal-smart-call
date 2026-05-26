import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Tenant } from '../tenants/tenant.entity';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async validateUser(tenant: Tenant, username: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { username, tenant: { id: tenant.id } },
    });

    if (!user) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    return user;
  }

  async login(tenant: Tenant, username: string, password: string) {
    const user = await this.validateUser(tenant, username, password);
    
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const payload = { sub: user.id, username: user.username, tenantId: tenant.id };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }

  async register(tenant: Tenant, data: RegisterDto) {
    const existing = await this.userRepo.findOne({
      where: { username: data.username, tenant: { id: tenant.id } },
    });

    if (existing) {
      throw new BadRequestException('用户名已存在');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = this.userRepo.create({
      tenant,
      username: data.username,
      password: passwordHash,
      name: data.name || data.username,
      role: (data.role as any) || 'agent',
      email: data.email,
      phone: data.phone,
    });

    await this.userRepo.save(user);

    return {
      id: user.id,
      username: user.username,
      role: user.role,
    };
  }

  async findAllUsers(tenant: Tenant) {
    return this.userRepo.find({
      where: { tenant: { id: tenant.id } },
      select: ['id', 'username', 'role', 'createdAt'],
    });
  }
}

export interface RegisterDto {
  username: string;
  password: string;
  role?: 'admin' | 'agent' | 'manager';
  email?: string;
  phone?: string;
  name?: string;
}
