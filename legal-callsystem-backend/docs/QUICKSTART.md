# 快速启动指南

## 1. 环境准备

### 安装 PostgreSQL
```bash
# macOS (Homebrew)
brew install postgresql@14
brew services start postgresql@14

# 创建数据库
createdb legal_call_db
```

### 安装 Redis
```bash
# macOS (Homebrew)
brew install redis
brew services start redis
```

## 2. 项目初始化

```bash
cd legal-callsystem

# 安装依赖
npm install

# 复制环境变量
cp .env.example .env

# 编辑 .env 配置数据库连接
```

## 3. 修改 .env 关键配置

```bash
# 数据库
DB_HOST=localhost
DB_PORT=5432
DB_NAME=legal_call_db
DB_USER=postgres
DB_PASSWORD=你的密码

# JWT 密钥（生产环境务必修改）
JWT_SECRET=your_secret_key_here

# 租户加密密钥（32 字符）
TENANT_ENCRYPTION_KEY=change_this_32_characters
```

## 4. 启动开发服务器

```bash
npm run start:dev
```

启动成功后会显示：
```
🚀 法律智能外呼系统启动成功：http://localhost:3000/api
```

## 5. 测试 API

### 创建第一个租户
```bash
curl -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name":"测试律所","dailyCallLimit":50}'
```

返回示例：
```json
{
  "id": "uuid...",
  "name": "测试律所",
  "licenseKey": "LC-XXXXXXX-YYYYYYY",
  "status": "active",
  "dailyCallLimit": 50
}
```

**保存 licenseKey，后续 API 调用需要在 header 中携带：**
```
x-tenant-key: LC-XXXXXXX-YYYYYYY
```

### 添加客户
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -H "x-tenant-key: LC-XXXXXXX-YYYYYYY" \
  -d '{
    "name": "张三",
    "phone": "13800138000",
    "caseType": "离婚纠纷",
    "source": "import"
  }'
```

## 6. 下一步

框架已完成，接下来需要：

1. **对接外呼 API** - 在 `calls.service.ts` 的 `makeCall()` 方法中接入阿里云/腾讯云
2. **上传话术录音** - 录制律所专业话术，上传到 OSS
3. **配置 TTS** - 如需动态内容，配置阿里云智能语音
4. **企业微信** - 在 `wechat.service.ts` 中对接企业微信 API
5. **前端后台** - 开发 Vue3 管理界面

## 常见问题

### 端口被占用
修改 `.env` 中的 `PORT=3001`

### 数据库连接失败
检查 PostgreSQL 是否启动：`brew services list`

### 依赖安装失败
删除 `node_modules` 和 `package-lock.json` 后重试：
```bash
rm -rf node_modules package-lock.json
npm install
```
