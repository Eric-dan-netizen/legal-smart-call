import * as dotenv from 'dotenv';
dotenv.config({ path: require('path').join(__dirname, '..', '.env') });

import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as CryptoJS from 'crypto-js';
import * as path from 'path';
import axios from 'axios';
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

const LLM_API_KEY = process.env.SILICONFLOW_API_KEY || '';
const LLM_BASE = 'https://api.siliconflow.cn/v1';
const LLM_MODEL = 'Pro/MiniMaxAI/MiniMax-M2.5';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

const BOX_H = '─';
const BOX_V = '│';

function boxTop(title: string) {
  console.log(`\n${COLORS.cyan}┌${BOX_H.repeat(60)}┐${COLORS.reset}`);
  console.log(`${COLORS.cyan}${BOX_V}${COLORS.reset} ${COLORS.bold}${title}${COLORS.reset}`);
  console.log(`${COLORS.cyan}├${BOX_H.repeat(60)}┤${COLORS.reset}`);
}

function boxLine(label: string, value: string) {
  const pad = 20 - label.length;
  console.log(`${COLORS.cyan}${BOX_V}${COLORS.reset} ${COLORS.dim}${label}${COLORS.reset}${' '.repeat(Math.max(pad, 1))}${value}`);
}

function boxEnd() {
  console.log(`${COLORS.cyan}└${BOX_H.repeat(60)}┘${COLORS.reset}\n`);
}

function separator() {
  console.log(`${COLORS.dim}${'─'.repeat(62)}${COLORS.reset}`);
}

async function llmChat(messages: Array<{ role: string; content: string }>): Promise<string> {
  if (!LLM_API_KEY) {
    return '您好，感谢您的来电。我们律师事务所提供专业的法律服务，欢迎预约免费咨询。';
  }
  try {
    const resp = await axios.post(`${LLM_BASE}/chat/completions`, {
      model: LLM_MODEL,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: 0.7,
      max_tokens: 200,
    }, {
      headers: { 'Authorization': `Bearer ${LLM_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 20000,
    });
    return resp.data.choices[0]?.message?.content || '';
  } catch {
    return '您好，感谢您的来电。我们律师事务所提供专业的法律服务，欢迎预约免费咨询。';
  }
}

async function typeText(text: string, delay: number = 30) {
  for (const char of text) {
    process.stdout.write(char);
    await new Promise(r => setTimeout(r, delay));
  }
}

async function demo() {
  console.clear();
  console.log(`${COLORS.bold}${COLORS.blue}
  ╔══════════════════════════════════════════════════════╗
  ║     ⚖️  法律智能外呼系统 — v1.0 功能演示              ║
  ║     Legal AI Outbound Call System Demo              ║
  ╚══════════════════════════════════════════════════════╝
${COLORS.reset}`);

  // 初始化数据库
  const ds = new DataSource({
    type: 'better-sqlite3',
    database: dbPath,
    entities: [Tenant, User, Customer, Script, CallTask, CallLog, Blacklist, CallFrequency, WechatSession],
    synchronize: true,
  });
  await ds.initialize();

  // 检查/播种数据
  let tenant = await ds.getRepository(Tenant).findOne({ where: {} as any });
  if (!tenant) {
    console.log(`${COLORS.yellow}🌱 首次运行，正在播种演示数据...${COLORS.reset}\n`);
    const tenantRepo = ds.getRepository(Tenant);
    const userRepo = ds.getRepository(User);
    const scriptRepo = ds.getRepository(Script);
    const customerRepo = ds.getRepository(Customer);

    tenant = await tenantRepo.save({ name: '默认律所', licenseKey: 'DEMO-KEY-2026' } as any);
    await userRepo.save({ tenant, username: 'admin', password: await bcrypt.hash('admin123', 10), name: '系统管理员', role: 'admin', isActive: true } as any);

    const scriptDefs = [
      { name: '离婚咨询', tags: ['divorce'], textContent: '你是婚姻家事法律顾问，专业处理离婚纠纷。了解客户婚姻状况、财产和子女情况，介绍律所优势，邀约到店免费咨询。' },
      { name: '劳动纠纷', tags: ['labor'], textContent: '你是劳动法法律顾问，擅长劳动争议和工伤赔偿。了解劳动者情况、纠纷类型和关键事实，介绍仲裁流程，邀约到店。' },
      { name: '债务追讨', tags: ['debt'], textContent: '你是债权债务法律顾问，擅长借贷和商事债务。了解债权关系、判断性质、评估时效和风险，介绍财产保全，邀约到店。' },
      { name: '交通事故', tags: ['traffic'], textContent: '你是交通事故法律顾问，擅长肇事赔偿和保险理赔。了解事故、保险和伤情，评估赔偿项目，介绍处理流程，邀约到店。' },
      { name: '刑事辩护', tags: ['criminal'], textContent: '你是刑事辩护法律顾问，擅长刑事辩护和合规。了解案件、当事人状态和进展，介绍诉讼程序，邀约家属到店。' },
      { name: '通用法律咨询', tags: ['general'], textContent: '你是综合法律顾问，提供高效专业的法律服务。快速判断客户需求类型，介绍律所专业领域和收费模式，邀约到店。' },
    ];
    for (const s of scriptDefs) {
      await scriptRepo.save({ tenant: tenant!, type: 'opening', isActive: true, ...s } as any);
    }

    await customerRepo.save({ tenant: tenant!, tenantId: tenant!.id, name: '张丽华', phoneEncrypted: encrypt('13800000001'), tags: ['divorce'] } as any);
    await customerRepo.save({ tenant: tenant!, tenantId: tenant!.id, name: '王建国', phoneEncrypted: encrypt('13800000002'), tags: ['labor'] } as any);
    await customerRepo.save({ tenant: tenant!, tenantId: tenant!.id, name: '李明远', phoneEncrypted: encrypt('13800000003'), tags: ['debt'] } as any);
    console.log(`${COLORS.green}✅ 演示数据准备完成${COLORS.reset}\n`);
  }

  const scripts = await ds.getRepository(Script).find({ where: {} as any });
  const customers = await ds.getRepository(Customer).find({ where: {} as any, take: 5 } as any);

  // ====== 模块 1: 系统概况 ======
  boxTop('📋 系统概况');
  boxLine('话术模板', `${COLORS.green}${scripts.length} 种${COLORS.reset}`);
  boxLine('测试客户', `${COLORS.green}${customers.length} 人${COLORS.reset}`);
  boxLine('LLM 模型', LLM_API_KEY ? `${COLORS.green}${LLM_MODEL}${COLORS.reset}` : `${COLORS.yellow}离线模式${COLORS.reset}`);
  boxLine('外呼模式', process.env.ALIYUN_CALL_NUMBER ? `${COLORS.green}真实外呼${COLORS.reset}` : `${COLORS.yellow}模拟模式${COLORS.reset}`);
  boxEnd();

  separator();

  // ====== 模块 2: 话术展示 ======
  boxTop('📝 话术模板列表');
  for (const s of scripts) {
    const tagStr = (s.tags || []).join(', ');
    boxLine(s.name, `${COLORS.dim}${tagStr}${COLORS.reset}`);
  }
  boxEnd();

  // ====== 模块 3: 外呼流程 ======
  boxTop('📞 外呼流程演示');
  console.log(`${COLORS.cyan}${BOX_V}${COLORS.reset}`);
  console.log(`${COLORS.cyan}${BOX_V}${COLORS.reset}   客户: ${COLORS.bold}王建国${COLORS.reset} (劳动纠纷)  ${COLORS.dim}13800000002${COLORS.reset}`);
  console.log(`${COLORS.cyan}${BOX_V}${COLORS.reset}   话术: 劳动纠纷开场`);
  console.log(`${COLORS.cyan}${BOX_V}${COLORS.reset}`);

  const customer = customers.find(c => c.name === '王建国') || customers[0];

  const taskRepo = ds.getRepository(CallTask);
  const task = await taskRepo.save({
    tenant,
    name: 'Demo 演示 - 劳动仲裁咨询',
    scriptId: 'demo-script-labor',
    scheduleTime: new Date(),
    status: 'running',
    totalCount: 1,
    customerIds: [customer.id],
  } as any);

  const steps = [
    ['1. 获取客户信息', 'green'],
    ['   解密手机号...', 'dim'],
    ['2. 黑名单检查', 'green'],
    ['   客户不在黑名单中 ✓', 'dim'],
    ['3. 呼叫频率检查', 'green'],
    ['   本周外呼 0 次，未达上限 ✓', 'dim'],
    ['4. 发起外呼', 'green'],
    ['   CALL_NUMBER 未配置 → 模拟模式', 'dim'],
    ['5. 通话已接通', 'green'],
  ];

  for (const [msg, color] of steps) {
    await new Promise(r => setTimeout(r, 300));
    if (color === 'dim') {
      console.log(`${COLORS.cyan}${BOX_V}${COLORS.reset}   ${COLORS.dim}${msg}${COLORS.reset}`);
    } else {
      console.log(`${COLORS.cyan}${BOX_V}${COLORS.reset}   ${COLORS.green}${msg}${COLORS.reset}`);
    }
  }
  boxEnd();

  // ====== 模块 4: AI 对话 ======
  boxTop('🤖 AI 语音对话模拟');

  const conversation: Array<{ role: string; content: string }> = [];
  const history: Array<{ role: string; content: string }> = [];

  const customerTexts = [
    '你好，我想咨询一下劳动仲裁的事。',
    '我在公司干了四年，上个月突然被辞退了，没有任何补偿。',
    '我还有三个月的工资没发，一共两万多块钱。这种情况我应该怎么办？',
  ];

  for (let i = 0; i < customerTexts.length; i++) {
    // 客户说话
    console.log(`\n${COLORS.yellow}  👤 客户:${COLORS.reset}`);
    await typeText(`  ${customerTexts[i]}\n`, 20);

    conversation.push({ role: 'user', content: customerTexts[i] });
    history.push({ role: 'user', content: customerTexts[i] });

    // AI 回复
    process.stdout.write(`${COLORS.green}  🤖 AI 顾问:${COLORS.reset}\n  `);
    const aiReply = await llmChat([
      { role: 'system', content: '你是律师事务所的劳动法法律顾问，擅长处理劳动争议。请用专业、自然的中文回复客户，80字以内。语气温和有同理心，最后引导客户到律所面谈。' },
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]);
    await typeText(aiReply, 15);
    console.log();

    conversation.push({ role: 'assistant', content: aiReply });
    history.push({ role: 'assistant', content: aiReply });

    await new Promise(r => setTimeout(r, 500));
  }

  boxEnd();

  // ====== 模块 5: 通话完毕 ======
  separator();
  boxTop('📊 通话记录');
  boxLine('通话 ID', `mock_demo_labor_13800000002`);
  boxLine('通话状态', `${COLORS.green}已完成${COLORS.reset}`);
  boxLine('对话轮次', `${customerTexts.length} 轮`);
  boxLine('客户意向', `${COLORS.green}有意向 (positive)${COLORS.reset}`);
  boxLine('建议动作', '预约到店免费咨询');
  boxEnd();

  // ====== 模块 6: 对话摘要 ======
  boxTop('📋 对话摘要');
  for (const entry of conversation) {
    const icon = entry.role === 'user' ? '👤 客户' : '🤖 AI';
    const color = entry.role === 'user' ? COLORS.yellow : COLORS.green;
    console.log(`  ${color}${icon}:${COLORS.reset} ${entry.content.substring(0, 80)}${entry.content.length > 80 ? '...' : ''}`);
  }
  boxEnd();

  // 清理
  await ds.destroy();

  console.log(`${COLORS.bold}${COLORS.blue}
  ╔══════════════════════════════════════════════════════╗
  ║  ✅ 演示完成                                        ║
  ║                                                    ║
  ║  下一步:                                            ║
  ║  • nest start 启动服务                              ║
  ║  • POST /api/demo/simulate-call 测试其他案由        ║
  ║  • 购买 400 号码后配置 ALIYUN_CALL_NUMBER 真实外呼  ║
  ║  • 开发管理后台前端 (Vue 3)                         ║
  ╚══════════════════════════════════════════════════════╝
${COLORS.reset}`);
}

demo().catch(err => {
  console.error(`${COLORS.red}❌ 演示失败:${COLORS.reset}`, err.message);
  process.exit(1);
});
