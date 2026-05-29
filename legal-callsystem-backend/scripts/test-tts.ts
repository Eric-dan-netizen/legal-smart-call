import * as dotenv from 'dotenv';
dotenv.config({ path: require('path').join(__dirname, '..', '.env') });

import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const AK_ID = process.env.ALIYUN_ACCESS_KEY_ID || '';
const AK_SECRET = process.env.ALIYUN_ACCESS_KEY_SECRET || '';
const APP_KEY = process.env.NLS_APP_KEY || '';

const COLORS = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', red: '\x1b[31m',
};

function hmacSha1(key: string, str: string): string {
  return crypto.createHmac('sha1', key).update(str).digest('base64');
}

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, '%21').replace(/'/g, '%27').replace(/\(/g, '%28')
    .replace(/\)/g, '%29').replace(/\*/g, '%2A').replace(/\+/g, '%20')
    .replace(/%7E/g, '~');
}

async function getNlsToken(): Promise<string> {
  const params: Record<string, string> = {
    AccessKeyId: AK_ID,
    Action: 'CreateToken',
    Format: 'JSON',
    RegionId: 'cn-shanghai',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: Math.random().toString(36).substring(2),
    SignatureVersion: '1.0',
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2019-02-28',
  };

  const sortedKeys = Object.keys(params).sort();
  const queryString = sortedKeys.map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&');
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(queryString)}`;
  const signature = hmacSha1(`${AK_SECRET}&`, stringToSign);

  const resp = await axios.post(
    'https://nls-meta.cn-shanghai.aliyuncs.com/pop/2018-05-18/token',
    null,
    {
      params: new URLSearchParams({ ...params, Signature: signature }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    },
  );
  return resp.data.Token?.Id || '';
}

async function testAliyunTTS(text: string): Promise<{ filePath: string; duration: number; size: number }> {
  const token = await getNlsToken();
  if (!token) throw new Error('获取 NLS Token 失败');

  const startTime = Date.now();
  const params = new URLSearchParams({
    appkey: APP_KEY,
    text: text.substring(0, 300),
    voice: 'xiaoyun',
    format: 'mp3',
    sample_rate: '16000',
    volume: '50',
    speech_rate: '0',
    pitch_rate: '0',
  });

  const resp = await axios.post(
    `https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/tts?${params.toString()}`,
    null,
    {
      headers: {
        'X-NLS-Token': token,
        'Content-Type': 'application/octet-stream',
      },
      timeout: 15000,
      responseType: 'arraybuffer',
    },
  );

  const latency = Date.now() - startTime;
  const outDir = path.join(__dirname, '..', 'data', 'tts-output');
  fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, `tts_test_${Date.now()}.mp3`);
  fs.writeFileSync(filePath, Buffer.from(resp.data));

  return { filePath, duration: latency, size: resp.data.length };
}

async function main() {
  console.log(`${COLORS.bold}${COLORS.blue}
  ╔══════════════════════════════════════════════════╗
  ║     🔊 TTS 语音合成联调测试                       ║
  ╚══════════════════════════════════════════════════╝
${COLORS.reset}`);

  console.log(`${COLORS.cyan}配置检查:${COLORS.reset}`);
  console.log(`  TTS 提供商:    ${COLORS.green}${process.env.TTS_PROVIDER || 'aliyun'}${COLORS.reset}`);
  console.log(`  NLS AppKey:    ${APP_KEY ? COLORS.green + '已配置' : COLORS.red + '未配置'}${COLORS.reset}`);
  console.log(`  AK ID:         ${AK_ID ? COLORS.green + '已配置' : COLORS.red + '未配置'}${COLORS.reset}`);
  console.log(`  AK Secret:     ${AK_SECRET ? COLORS.green + '已配置' : COLORS.red + '未配置'}${COLORS.reset}`);
  console.log(`  Azure Key:     ${process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_KEY !== 'your_azure_speech_key' ? COLORS.green + '已配置' : COLORS.yellow + '未配置(占位)'}${COLORS.reset}\n`);

  const testTexts = [
    { label: '短句 (12字)', text: '您好，请问有什么法律问题需要咨询？' },
    { label: '中句 (45字)', text: '根据劳动法规定，工作满一年支付一个月工资作为经济补偿。您的情况属于违法解除劳动合同，可以主张双倍赔偿金，共计八个月工资。建议您收集劳动合同和工资流水等证据材料。' },
    { label: '长句 (98字)', text: '您的情况我们初步分析如下：第一，公司拖欠三个月工资约两万元，属于无故拖欠劳动报酬；第二，在您工作四年期间突然被辞退且无任何补偿，涉嫌违法解除劳动合同。根据劳动合同法第87条规定，用人单位违法解除劳动合同的，应当按经济补偿标准的二倍支付赔偿金。建议您携带劳动合同、工资流水等材料到律所，我们为您做免费案件评估。' },
  ];

  let allPassed = true;

  for (const { label, text } of testTexts) {
    try {
      console.log(`${COLORS.cyan}测试: ${label}${COLORS.reset}`);
      const result = await testAliyunTTS(text);
      const status = result.size > 1000 ? COLORS.green + '✓ 通过' : COLORS.yellow + '⚠ 文件过小';
      console.log(`  文件: ${result.filePath}`);
      console.log(`  大小: ${(result.size / 1024).toFixed(1)} KB  |  延迟: ${result.duration}ms  |  ${status}${COLORS.reset}\n`);
    } catch (err: any) {
      allPassed = false;
      console.log(`  ${COLORS.red}✗ 失败: ${err.message}${COLORS.reset}\n`);
    }
  }

  console.log(`${COLORS.bold}${allPassed ? COLORS.green + '✅ TTS 联调全部通过' : COLORS.red + '❌ 部分测试失败'}${COLORS.reset}`);
}

main().catch(err => {
  console.error(`${COLORS.red}❌ TTS 测试异常:${COLORS.reset}`, err.message);
  process.exit(1);
});
