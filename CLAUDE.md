# 智能外呼系统 — Claude Code 工作流

## 项目一句话

法律行业 SaaS 多租户智能外呼平台。AI 语音机器人完成法律咨询初筛和案源筛选，替代人工重复外呼。

## 技术栈

| 层 | 技术 |
|---|------|
| 后端 | NestJS + TypeScript + TypeORM + PostgreSQL |
| 前端 | Vue 3 + Element Plus（待开发） |
| 语音链路 | 阿里云语音服务 DoublePlay API → ASR（阿里云 NLS） → LLM（SiliconFlow/MiniMax DeepSeek-M2.5） → TTS（阿里云/Azure/CosyVoice2） |
| 基础设施 | 阿里云 ECS / RDS / OSS / Redis |
| 网关 | OpenClaw Gateway（模型路由和负载均衡） |

## 代码位置

```
/Users/apple/Documents/智能外呼系统/
├── legal-callsystem-backend/     # NestJS 后端
│   └── src/modules/
│       ├── auth/                 # JWT 认证 + 用户管理
│       ├── tenants/              # 多租户 + LicenseKey
│       ├── customers/            # 客户管理（AES 加密存储）
│       ├── calls/                # 外呼引擎：任务调度、黑名单、频率限制、阿里云 API
│       ├── scripts/              # 话术管理（录音/TTS 双模式）
│       ├── voice/                # ASR → LLM → TTS 实时编排
│       ├── wechat/               # 企业微信集成
│       └── common/               # TTS/OSS 通用服务
└── docs/
    ├── QUICKSTART.md             # 快速启动
    ├── SCRIPTS.md                # 法律话术设计
    └── COMPLIANCE.md             # 合规检查清单
```

## 核心架构

### 外呼链路
```
客户接听 → 阿里云双呼 → WebSocket 音频流
  → ASR 识别 → LLM 生成回复 → TTS 合成语音 → 返回音频流
  → 全程 < 1.2s 延迟（含 barge-in 打断处理）
```

### 外呼流程
```
1. 获取客户信息（解密手机号）
   ↓
2. 检查黑名单 → 跳过
   ↓
3. 检查频率限制（同号每周 ≤ 3 次，8:00-21:00）
   ↓
4. 调用阿里云外呼 API
   ↓
5. 记录频率 + 通话日志
```

## 关键约束

- **延迟上限**：端到端 < 1.2s，用户感知不到是机器人
- **打断处理**：barge-in 功能——客户随时可以插话打断
- **合规红线**：黑名单、退订、频率限制、时间窗口，缺一不可
- **多租户隔离**：所有查询必须通过 tenant guard，客户数据 AES 加密
- **成本控制**：外呼 0.36 元/通，先小批量测试（5-10 通/天），再放量

## 当前状态（截至 2026-03-12）

| 模块 | 完成度 | 说明 |
|------|--------|------|
| 后端核心 | 95% | 框架完成，**缺阿里云密钥配置** |
| 阿里云外呼 API | 90% | 代码就绪，配置后可用；支持模拟模式测试 |
| 语音链路 | 60% | ASR/TTS/LLM 模块已写，待端到端联调 |
| 前端管理后台 | 0% | 未启动 |
| 生产部署 | 0% | 未部署 |

### 阻塞项
- `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET` — 阿里云 API 密钥
- `ALIYUN_CALL_APP_KEY` — 智能语音服务应用密钥
- `ALIYUN_CALL_NUMBER` — 外呼显示号码（需购买）
- PostgreSQL / Redis — 本地或服务器安装

## 角色体系

默认使用总设计师模式（`claude` 启动）。
其他角色按需：
```bash
claude --claude-md .claude/roles/backend-dev.md              # 纯 NestJS 后端
claude --claude-md .claude/roles/frontend-dev.md             # 纯 Vue3 前端
claude --claude-md .claude/roles/code-reviewer.md            # 代码审查
claude --claude-md .claude/roles/business-model-discussion.md  # 商业模式讨论
```

通用规则（安全红线、worktree 隔离、自动执行权限）参考 `.claude/roles/common_rules.md`

### 商业模式讨论规则

讨论商业模式、产品定位、盈利逻辑时，自动加载 `.claude/roles/business-model-discussion.md`：
- **魔鬼代言人**：不迎合，每个假设都要质疑
- **成本验证**：所有数字与实际 API/人力成本交叉验证
- **对齐再动手**：客户是谁、痛点是什么、为什么付费——三个问题不搞清楚不写代码
- **保密**：商业讨论内容不写入 memory、不对外，仅在用户指定路径输出

## Worktree 隔离规则

并行启动多个写代码 Agent 时：
- ≥2 个写代码 Agent → 每方 `isolation: "worktree"`
- 改动 + 审查并行 → 审查方 worktree
- 两个 Agent 改相同文件 → **禁止并行**，串行执行
- 只读 Agent（Explore/Plan/审查）不需要 worktree

## 服务与密钥（见 钥匙.md）

- 阿里云 AK: `LTAI5tHfrZeT2Mxc4Gk6edDL`
- 阿里云 ECS: `47.113.190.38` SSH 端口 2222
- OpenAI/LLM API: 见 `钥匙.md`
- **安全红线：以上密钥不得提交到 git、不得在对话外转发**
