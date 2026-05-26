# 法律行业智能外呼系统

> 专为律所设计的 SaaS 多租户智能外呼平台

## 功能特性

- ✅ **多租户架构** - 支持多个律所独立使用，数据完全隔离
- ✅ **智能外呼** - 自动批量外呼，支持定时任务
- ✅ **话术管理** - 支持录音/TTS 两种模式
- ✅ **客户管理** - 完整的 CRM 功能，跟进状态追踪
- ✅ **微信集成** - 自动添加客户企业微信
- ✅ **通话录音** - 100% 录音存档，合规可追溯
- ✅ **意图识别** - 关键词匹配，自动判断客户意向
- ✅ **数据安全** - 手机号加密存储，权限隔离

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | NestJS + TypeScript |
| 数据库 | PostgreSQL |
| 缓存 | Redis |
| 外呼 | 阿里云语音服务 / 腾讯云呼叫中心 |
| TTS | 阿里云智能语音 / Azure TTS |
| 存储 | 阿里云 OSS |

## 快速开始

### 环境要求

- Node.js >= 18
- PostgreSQL >= 14
- Redis >= 6

### 安装依赖

```bash
cd legal-callsystem
npm install
```

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入你的配置
```

### 启动开发服务器

```bash
npm run start:dev
```

### 构建生产版本

```bash
npm run build
npm run start:prod
```

## 项目结构

```
legal-callsystem/
├── src/
│   ├── modules/
│   │   ├── auth/          # 认证授权
│   │   ├── tenants/       # 多租户管理
│   │   ├── customers/     # 客户管理
│   │   ├── calls/         # 外呼引擎
│   │   ├── scripts/       # 话术管理
│   │   └── wechat/        # 微信集成
│   ├── guards/            # 守卫
│   ├── decorators/        # 装饰器
│   ├── database/          # 数据库配置
│   └── main.ts            # 入口文件
├── .env.example           # 环境变量模板
├── package.json
└── README.md
```

## API 文档

启动后访问：`http://localhost:3000/api`

### 核心接口

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 租户 | POST | /api/tenants | 创建新租户 |
| 租户 | GET | /api/tenants | 获取租户列表 |
| 客户 | POST | /api/customers | 添加客户 |
| 客户 | POST | /api/customers/batch | 批量导入 |
| 客户 | GET | /api/customers | 客户列表 |
| 外呼 | POST | /api/calls/tasks | 创建外呼任务 |
| 外呼 | POST | /api/calls/tasks/:id/start | 启动任务 |
| 外呼 | GET | /api/calls/logs | 通话记录 |

## 合规说明

⚠️ **使用本系统需遵守以下法规：**

- 《个人信息保护法》- 客户信息需合法获取
- 《通信短信息服务管理规定》- 需提供退订机制
- 《民法典》- 不得骚扰、不得冒充公检法

建议：
- 外呼前确保客户同意或合法来源
- 同一号码每周外呼≤3 次
- 通话录音保存≥6 个月
- 提供"回复 T 退订"选项

## 成本估算

| 项目 | 费用 |
|------|------|
| 服务器 (2 核 4G) | ~200 元/月 |
| 外呼线路 (50 通/天) | ~540 元/月 |
| TTS (按需) | ~100 元/月 |
| 云存储 | ~50 元/月 |
| **合计** | **~900 元/月** |

## 开发计划

- [x] 项目框架搭建
- [x] 多租户架构
- [x] 客户管理模块
- [x] 外呼任务模块
- [ ] 阿里云通信 API 对接
- [ ] TTS 语音合成对接
- [ ] 企业微信集成
- [ ] 前端管理后台
- [ ] 数据统计看板

## License

MIT
