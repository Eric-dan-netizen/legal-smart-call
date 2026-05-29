import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import * as CryptoJS from 'crypto-js';
import { CallsModule } from '../../src/modules/calls/calls.module';
import { VoiceModule } from '../../src/modules/voice/index';
import { CallsService } from '../../src/modules/calls/calls.service';
import { BlacklistService } from '../../src/modules/calls/blacklist.service';
import { CallFrequencyService } from '../../src/modules/calls/call-frequency.service';
import { Tenant } from '../../src/modules/tenants/tenant.entity';
import { User } from '../../src/modules/auth/user.entity';
import { Customer } from '../../src/modules/customers/customer.entity';
import { CallTask } from '../../src/modules/calls/call-task.entity';
import { CallLog } from '../../src/modules/calls/call-log.entity';
import { Blacklist } from '../../src/modules/calls/blacklist.entity';
import { CallFrequency } from '../../src/modules/calls/call-frequency.entity';
import { Script } from '../../src/modules/scripts/script.entity';
import { WechatSession } from '../../src/modules/wechat/wechat-session.entity';
import { CallTaskStatus, CallStatus } from '../../src/modules/calls/types';

const encryptKey = 'legal_call_encryption_32c';
const encrypt = (phone: string) => CryptoJS.AES.encrypt(phone, encryptKey).toString();

describe('Call Flow E2E (v0.8)', () => {
  jest.setTimeout(30000);
  let module: TestingModule;
  let callsService: CallsService;
  let blacklistService: BlacklistService;
  let frequencyService: CallFrequencyService;
  let tenantRepo: Repository<Tenant>;
  let customerRepo: Repository<Customer>;
  let taskRepo: Repository<CallTask>;
  let logRepo: Repository<CallLog>;

  let tenant: Tenant;
  let customer: Customer;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Tenant, User, Customer, CallTask, CallLog, Blacklist, CallFrequency, Script, WechatSession],
          synchronize: true,
        }),
        ScheduleModule.forRoot(),
        TypeOrmModule.forFeature([Tenant, Customer, CallTask, CallLog]),
        CallsModule,
        VoiceModule,
      ],
    }).compile();

    callsService = module.get(CallsService);
    blacklistService = module.get(BlacklistService);
    frequencyService = module.get(CallFrequencyService);
    tenantRepo = module.get(getRepositoryToken(Tenant));
    customerRepo = module.get(getRepositoryToken(Customer));
    taskRepo = module.get(getRepositoryToken(CallTask));
    logRepo = module.get(getRepositoryToken(CallLog));

    tenant = await tenantRepo.save({ name: '测试律所', licenseKey: 'TEST-KEY' } as any);
    customer = await customerRepo.save({
      name: '测试客户',
      phoneEncrypted: encrypt('13800000000'),
      tenantId: tenant.id,
    } as any);
  });

  afterAll(async () => {
    await module?.close();
  });

  it('should execute full call flow (simulated)', async () => {
    const task = await taskRepo.save({
      tenant,
      name: 'E2E 测试任务',
      scriptId: 'script-001',
      scheduleTime: new Date(),
      status: CallTaskStatus.RUNNING,
      totalCount: 1,
      customerIds: [customer.id],
    } as any);

    const result = await callsService.executeCall(task, customer.id);

    expect(result.success).toBe(true);
    expect(result.callId).toMatch(/^mock_/);
    expect(result.sessionId).toBeTruthy();

    const logs = await logRepo.find({ where: { callId: result.callId } } as any);
    expect(logs.length).toBe(1);
    expect(logs[0].callStatus).toBe(CallStatus.ANSWERED);
  });

  it('should block blacklisted customer', async () => {
    const blockedCustomer = await customerRepo.save({
      name: '黑名单客户',
      phoneEncrypted: encrypt('13800001111'),
      tenantId: tenant.id,
    } as any);
    await blacklistService.add(tenant.id, { phone: '13800001111' });

    const task = await taskRepo.save({
      tenant,
      name: '黑名单测试',
      scriptId: 'script-001',
      scheduleTime: new Date(),
      status: CallTaskStatus.RUNNING,
      totalCount: 1,
      customerIds: [blockedCustomer.id],
    } as any);

    const result = await callsService.executeCall(task, blockedCustomer.id);

    expect(result.success).toBe(false);
    expect(result.error).toContain('黑名单');
  });

  it('should block customer exceeding frequency limit', async () => {
    const freqCustomer = await customerRepo.save({
      name: '超频客户',
      phoneEncrypted: encrypt('13800002222'),
      tenantId: tenant.id,
    } as any);
    await frequencyService.recordCall(tenant.id, '13800002222');
    await frequencyService.recordCall(tenant.id, '13800002222');
    await frequencyService.recordCall(tenant.id, '13800002222');

    const task = await taskRepo.save({
      tenant,
      name: '频率限制测试',
      scriptId: 'script-001',
      scheduleTime: new Date(),
      status: CallTaskStatus.RUNNING,
      totalCount: 1,
      customerIds: [freqCustomer.id],
    } as any);

    const result = await callsService.executeCall(task, freqCustomer.id);

    expect(result.success).toBe(false);
    expect(result.error).toContain('3');
  });
});
