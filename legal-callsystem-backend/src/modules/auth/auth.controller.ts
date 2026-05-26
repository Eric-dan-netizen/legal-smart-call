import { Controller, Post, Body, Get, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Tenant } from '../tenants/tenant.entity';
import { TenantsService } from '../tenants/tenants.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(forwardRef(() => TenantsService))
    private readonly tenantsService: TenantsService,
  ) {}

  private async resolveTenant(tenantName?: string): Promise<Tenant> {
    if (!tenantName) {
      // Try to get default tenant
      let tenant = await this.tenantsService.findByName('默认律所');
      if (!tenant) {
        tenant = await this.tenantsService.create({ name: '默认律所' });
      }
      return tenant;
    }
    return this.tenantsService.findOrCreate(tenantName);
  }

  @Post('login')
  async login(@Body() data: { username: string; password: string; tenantKey?: string; tenantName?: string }) {
    // 支持 tenantKey 或 tenantName
    let tenant;
    if (data.tenantKey) {
      tenant = await this.tenantsService.findByLicenseKey(data.tenantKey);
    }
    if (!tenant && data.tenantName) {
      tenant = await this.resolveTenant(data.tenantName);
    }
    if (!tenant) {
      tenant = await this.resolveTenant(undefined);
    }
    
    const result = await this.authService.login(tenant, data.username, data.password);
    
    // 返回前端期望的格式
    return {
      success: true,
      data: {
        accessToken: result.access_token,
        tenantKey: tenant.licenseKey,
        user: result.user,
      },
    };
  }

  @Post('register')
  async register(@Body() data: { 
    username: string; 
    password: string; 
    tenantName?: string;
    role?: 'admin' | 'agent' | 'manager';
    email?: string;
    phone?: string;
    name?: string;
  }) {
    const tenant = await this.resolveTenant(data.tenantName);
    return this.authService.register(tenant, data);
  }

  @Get('users')
  async findAllUsers(@Body() data: { tenantName?: string }) {
    const tenant = await this.resolveTenant(data?.tenantName);
    return this.authService.findAllUsers(tenant);
  }
}
