import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as CryptoJS from 'crypto-js';
import { AppModule } from './app.module';
import { Tenant } from './modules/tenants/tenant.entity';
import { User } from './modules/auth/user.entity';
import { Customer } from './modules/customers/customer.entity';
import { Script } from './modules/scripts/script.entity';

const ENCRYPT_KEY = 'legal_call_encryption_32c';
const encrypt = (phone: string) => CryptoJS.AES.encrypt(phone, ENCRYPT_KEY).toString();

async function autoSeed(ds: DataSource) {
  const scriptCount = await ds.getRepository(Script).count();
  if (scriptCount > 0) return;

  console.log('🌱 检测到空数据库，自动播种演示数据...');

  const tenantRepo = ds.getRepository(Tenant);
  const userRepo = ds.getRepository(User);
  const scriptRepo = ds.getRepository(Script);
  const customerRepo = ds.getRepository(Customer);

  const tenant = await tenantRepo.save({ name: '演示律所', licenseKey: 'DEMO-KEY-2026' } as any);
  const passwordHash = await bcrypt.hash('admin123', 10);
  await userRepo.save({ tenant, username: 'admin', password: passwordHash, name: '系统管理员', role: 'admin', isActive: true } as any);

  const scripts = [
    { name: '离婚咨询开场', type: 'opening', tags: ['divorce'], textContent: '你是演示律所的婚姻家事法律顾问，擅长处理离婚纠纷。你的沟通风格专业、温和、有同理心。核心任务：了解婚姻状况、财产和子女情况，介绍律所优势，邀约客户到店。合规红线：不得承诺结果，不得教唆伪造证据。' },
    { name: '劳动纠纷开场', type: 'opening', tags: ['labor'], textContent: '你是演示律所的劳动法法律顾问，擅长处理劳动争议和工伤赔偿。你的沟通风格务实、清晰、有力量感。核心任务：了解劳动者情况、纠纷类型、关键事实，介绍仲裁和诉讼流程，邀约到店。合规红线：不得煽动过激维权，不得承诺保证具体金额。' },
    { name: '债务追讨开场', type: 'opening', tags: ['debt'], textContent: '你是演示律所的债权债务法律顾问，擅长处理民间借贷和商事债务纠纷。核心任务：了解债权债务关系、判断性质、评估时效和风险，介绍财产保全和执行手段，邀约到店。合规红线：不得教唆暴力讨债，不得承诺一定能追回。' },
    { name: '交通事故开场', type: 'opening', tags: ['traffic'], textContent: '你是演示律所的交通事故法律顾问，擅长处理交通肇事赔偿和保险理赔。核心任务：了解事故情况、保险情况、伤情进展，评估赔偿项目，介绍处理流程，邀约到店。合规红线：不得教唆伪造伤情，不得承诺具体金额。' },
    { name: '刑事辩护开场', type: 'opening', tags: ['criminal'], textContent: '你是演示律所的刑事辩护法律顾问，擅长刑事辩护和刑事合规。核心任务：了解案件情况、当事人状态、进展阶段，介绍诉讼程序，邀约家属到店。合规红线：不得教唆串供翻供，不得承诺一定能取保。' },
    { name: '通用法律咨询', type: 'opening', tags: ['general'], textContent: '你是演示律所的智能法律顾问，提供高效专业的法律服务。核心任务：了解客户需求，快速判断需求类型，介绍律所专业领域和收费模式，邀约到店。合规红线：不得承诺结果，遵守信息保密义务。' },
  ];
  for (const s of scripts) {
    await scriptRepo.save({ tenant, isActive: true, ...s } as any);
  }

  const customers = [
    { name: '张丽华', phoneEncrypted: encrypt('13800000001'), tenant, tenantId: tenant.id, tags: ['divorce'] },
    { name: '王建国', phoneEncrypted: encrypt('13800000002'), tenant, tenantId: tenant.id, tags: ['labor'] },
    { name: '李明远', phoneEncrypted: encrypt('13800000003'), tenant, tenantId: tenant.id, tags: ['debt'] },
    { name: '赵晓芳', phoneEncrypted: encrypt('13800000004'), tenant, tenantId: tenant.id, tags: ['traffic'] },
    { name: '陈志强', phoneEncrypted: encrypt('13800000005'), tenant, tenantId: tenant.id, tags: ['general'] },
  ];
  for (const c of customers) {
    await customerRepo.save(c as any);
  }

  console.log(`✅ 自动播种完成：${scripts.length} 种话术, ${customers.length} 个客户`);
  console.log('   登录信息: admin / admin123');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 开发环境自动播种演示数据
  if (configService.get('NODE_ENV') === 'development') {
    const ds = app.get(DataSource);
    await autoSeed(ds).catch(err => console.warn('⚠️ 自动播种跳过:', err.message));
  }

  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');

  const port = configService.get('PORT', 3000);
  await app.listen(port);

  console.log(`🚀 法律智能外呼系统启动成功: http://localhost:${port}/api`);
}

bootstrap();
