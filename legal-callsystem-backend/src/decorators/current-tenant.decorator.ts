import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

export const CurrentTenant = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    
    // 优先使用 guard 设置的 tenant
    if (request.tenant) {
      return request.tenant;
    }
    
    // 从 JWT token 中提取 tenantId
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.decode(token) as any;
        if (decoded?.tenantId) {
          // 返回 tenantId 字符串，让 TypeORM 直接使用
          return decoded.tenantId;
        }
      } catch (e) {
        // ignore
      }
    }
    
    throw new UnauthorizedException('无法获取租户信息');
  },
);
