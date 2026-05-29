import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as CryptoJS from 'crypto-js';
import * as path from 'path';
import { Tenant } from '../src/modules/tenants/tenant.entity';
import { User } from '../src/modules/auth/user.entity';
import { Customer } from '../src/modules/customers/customer.entity';
import { Script } from '../src/modules/scripts/script.entity';
import { CallTask } from '../src/modules/calls/call-task.entity';
import { CallLog } from '../src/modules/calls/call-log.entity';
import { Blacklist } from '../src/modules/calls/blacklist.entity';
import { CallFrequency } from '../src/modules/calls/call-frequency.entity';
import { WechatSession } from '../src/modules/wechat/wechat-session.entity';

const ENCRYPT_KEY = 'legal_call_encryption_32c';
const encrypt = (phone: string) => CryptoJS.AES.encrypt(phone, ENCRYPT_KEY).toString();

const dbPath = process.env.DB_SQLITE_PATH || path.join(__dirname, '..', 'data', 'legal-call.db');

async function seed() {
  console.log(`📦 初始化数据库: ${dbPath}`);

  const ds = new DataSource({
    type: 'better-sqlite3',
    database: dbPath,
    entities: [Tenant, User, Customer, Script, CallTask, CallLog, Blacklist, CallFrequency, WechatSession],
    synchronize: true,
  });
  await ds.initialize();

  const tenantRepo = ds.getRepository(Tenant);
  const userRepo = ds.getRepository(User);
  const customerRepo = ds.getRepository(Customer);
  const scriptRepo = ds.getRepository(Script);

  // 检查是否已有数据
  const existing = await tenantRepo.count();
  if (existing > 0) {
    console.log('⚠️  数据库已有数据，跳过播种。如需重新播种请先删除数据库文件。');
    await ds.destroy();
    return;
  }

  // 1. 创建演示租户
  const tenant = await tenantRepo.save({
    name: '默认律所',
    licenseKey: 'DEMO-KEY-2026',
  } as any);
  console.log(`✅ 租户: ${tenant.name}`);

  // 2. 创建管理员
  const passwordHash = await bcrypt.hash('admin123', 10);
  await userRepo.save({
    tenant,
    username: 'admin',
    password: passwordHash,
    name: '系统管理员',
    role: 'admin',
    email: 'admin@demo-law.com',
    isActive: true,
  } as any);
  console.log('✅ 管理员: admin / admin123');

  // 3. 创建 6 种法律话术
  const scripts = [
    {
      name: '离婚咨询开场',
      type: 'opening' as const,
      tags: ['divorce'],
      textContent: `你是默认律所的婚姻家事法律顾问，擅长处理离婚纠纷。你的沟通风格专业、温和、有同理心。

核心任务：
1. 了解客户的婚姻状况（感情基础、矛盾起因、分居情况）
2. 判断是否存在法定离婚事由
3. 了解财产状况（房产、存款、车辆、公司股权）
4. 了解子女情况（年龄、抚养意愿、抚养费能力）
5. 介绍律所婚姻家事领域的专业优势
6. 邀约客户携带相关材料到律所做免费案件评估

合规红线：
- 不得教唆客户伪造家暴证据或虚构事实
- 不得承诺"一定判离"或保证"100%成功"
- 离婚案件涉及子女的，不得发表不利于未成年人身心健康的言论`,
    },
    {
      name: '劳动纠纷开场',
      type: 'opening' as const,
      tags: ['labor'],
      textContent: `你是默认律所的劳动法法律顾问，擅长处理劳动争议和工伤赔偿。你的沟通风格务实、清晰、有力量感。

核心任务：
1. 了解劳动者基本情况（在职/离职、劳动合同签订情况、工龄）
2. 判断纠纷类型（欠薪、违法解除、工伤、社保、竞业限制）
3. 了解关键事实（欠薪金额、解除理由、工伤认定情况、证据持有）
4. 介绍劳动仲裁和诉讼的基本流程和时效
5. 介绍律所劳动法团队的胜诉案例
6. 邀约客户携带劳动合同等材料到律所做免费案件评估

合规红线：
- 不得煽动客户采取过激行为维权
- 不得承诺"一定能拿到XX赔偿"或保证具体金额
- 工伤案件中，不得建议客户不做工伤认定直接起诉`,
    },
    {
      name: '债务追讨开场',
      type: 'opening' as const,
      tags: ['debt'],
      textContent: `你是默认律所的债权债务法律顾问，擅长处理民间借贷和商事债务纠纷。你的沟通风格严谨、条理清晰。

核心任务：
1. 了解债权债务关系基本情况（借款金额、时间、利息约定、借条/合同）
2. 判断债务性质（民间借贷、货款、工程款、不当得利）
3. 了解债务人情况（是否失联、有无财产、偿还意愿）
4. 评估诉讼时效和执行风险
5. 介绍财产保全、支付令、强制执行等法律手段
6. 邀约客户携带借条/合同等证据材料到律所做免费案件评估

合规红线：
- 不得教唆客户以暴力、威胁、非法拘禁等手段讨债
- 不得承诺"一定能把钱追回来"或保证执行到位
- 高利贷案件应告知法律只保护合法利息`,
    },
    {
      name: '交通事故开场',
      type: 'opening' as const,
      tags: ['traffic'],
      textContent: `你是默认律所的交通事故法律顾问，擅长处理交通肇事赔偿和保险理赔。你的沟通风格细致、有耐心。

核心任务：
1. 了解事故基本情况（时间、地点、责任认定、受伤情况）
2. 了解保险情况（交强险、商业险、是否报案）
3. 了解伤情和治疗进展（住院天数、医疗费用、伤残等级）
4. 评估赔偿项目（医疗费、误工费、护理费、伤残赔偿金、精神损害）
5. 介绍交通事故处理流程和诉讼时效
6. 邀约客户携带事故认定书等材料到律所做免费案件评估

合规红线：
- 不得教唆客户伪造伤情或夸大损失
- 不得承诺具体赔偿金额
- 如涉及肇事逃逸案件，应提醒客户立即报警`,
    },
    {
      name: '刑事辩护开场',
      type: 'opening' as const,
      tags: ['criminal'],
      textContent: `你是默认律所的刑事辩护法律顾问，擅长刑事辩护和刑事合规。你的沟通风格沉稳、专业、给人安全感。

核心任务：
1. 了解案件基本情况（涉嫌罪名、办案单位、是否在押）
2. 了解当事人状态（是否被拘留、批捕、取保候审）
3. 了解案件进展阶段（侦查、审查起诉、审判）
4. 介绍刑事诉讼程序和当事人权利义务
5. 介绍律所刑事辩护团队的专业背景和成功案例
6. 邀约家属携带相关法律文书到律所做免费案件评估

合规红线：
- 不得教唆串供、翻供或毁灭证据
- 不得承诺"一定能取保"或"一定判缓刑"
- 不得暗示"有关系可以摆平"或"花钱能减刑"
- 如涉及未成年人犯罪，应告知法定代理人相关权利义务`,
    },
    {
      name: '通用法律咨询',
      type: 'opening' as const,
      tags: ['general'],
      textContent: `你是默认律所的智能法律顾问，致力于为客户提供高效、专业的法律服务。你的沟通风格专业、热情、有亲和力。

核心任务：
1. 礼貌问候来电客户，了解客户的基本信息和来电目的
2. 快速判断客户的法律需求类型（婚姻家事、劳动争议、债权债务、交通事故、刑事辩护、合同纠纷等）
3. 介绍律所在相关领域的专业优势和团队背景
4. 简要说明法律服务的流程和收费模式（免费咨询评估→委托代理→按阶段收费）
5. 邀约客户到律所做免费案件评估咨询
6. 如客户暂时不方便到店，记录联系方式并约定后续跟进时间

合规红线：
- 不得在未了解案情的情况下给出具体法律意见
- 不得承诺案件结果或保证"100%胜诉"
- 律师费不得以"风险代理"方式收取（刑事案件禁止风险代理）
- 严格遵守客户信息保密义务
- 客户明确表示不需要时，礼貌结束通话，不强行推销`,
    },
  ];

  for (const s of scripts) {
    await scriptRepo.save({ tenant, isActive: true, ...s } as any);
  }
  console.log(`✅ ${scripts.length} 种法律话术已创建`);

  // 4. 创建 5 个测试客户
  const customers = [
    { name: '张丽华', phoneEncrypted: encrypt('13800000001'), tags: ['divorce'] },
    { name: '王建国', phoneEncrypted: encrypt('13800000002'), tags: ['labor'] },
    { name: '李明远', phoneEncrypted: encrypt('13800000003'), tags: ['debt'] },
    { name: '赵晓芳', phoneEncrypted: encrypt('13800000004'), tags: ['traffic'] },
    { name: '陈志强', phoneEncrypted: encrypt('13800000005'), tags: ['general'] },
  ];

  for (const c of customers) {
    await customerRepo.save({ ...c, tenant, tenantId: tenant.id } as any);
  }
  console.log(`✅ ${customers.length} 个测试客户已创建`);

  await ds.destroy();
  console.log('🎉 种子数据播种完成！');
  console.log('   登录信息: admin / admin123');
}

seed().catch((err) => {
  console.error('❌ 播种失败:', err.message);
  process.exit(1);
});
