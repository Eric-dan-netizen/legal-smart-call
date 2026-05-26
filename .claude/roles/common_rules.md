# Claude Code 自动执行规则（安全优先）

## 一、可自动执行的操作（无需每次询问）

### 1. 文件操作
- 读取任何文件。
- 修改以下目录中的文件：`backend/app/`、`frontend/src/`、`terraform/`（不含变量文件）、`.github/workflows/`。
- 创建新的 `.py`、`.js`、`.jsx`、`.yaml`、`.json` 文件，但必须符合项目结构。
- 删除 `__pycache__/`、`.pyc`、`node_modules/` 下的临时文件（不得删除源代码）。
- 修改 `requirements.txt`、`package.json` 添加常规依赖（若涉及网络下载新包，需提示一次）。

### 2. 终端命令
- 执行 `python`、`pip`、`npm`、`pnpm`、`git` 相关常规命令（如 `pip install`、`npm run build`、`git status`、`git add`、`git commit -m "..."`）。
- **每次 `git pull` 或切换分支后，必须执行 `pip install -r requirements.txt` 同步 venv 依赖。**
- 运行测试命令（`pytest`、`npm test`）。
- 启动开发服务器（`uvicorn`、`vite`、`next dev`），并允许在后台运行。
- 执行 `terraform plan`、`terraform apply -auto-approve`（但 `terraform destroy` 必须询问）。

### 3. Git 操作
- `git add .`
- `git commit -m "消息"`（消息由你生成，我会审查）
- `git push origin main`（但若远程有冲突，需提示我手工解决）

### 4. Docker 操作
- `docker build`、`docker push`（前提是使用已配置的 ACR 仓库）
- `docker run`（不得挂载宿主敏感目录如 `/etc`, `~/.ssh`）

## 二、安全红线（任何情况都必须询问我）

**以下操作必须停下，并向我说明原因及将要执行的具体命令，得到明确授权（如输入 “允许”）后才能执行：**

- 修改任何包含 `secret`、`key`、`password`、`token`、`credential` 字样的文件或环境变量文件（如 `.env`、`.secrets`、`*.pem`）。
- 修改 `terraform/variables.tf` 中包含 `password`、`key`、`secret` 的变量默认值。
- 删除文件或目录（自动清理缓存除外）。
- 执行 `rm`、`rm -rf`、`sudo`、`chmod`、`chown`。
- 连接生产数据库（任何以 `pgm-*.rds.aliyuncs.com` 为 host 的连接）。
- 修改 GitHub Secrets 或阿里云 AccessKey。
- 执行 `terraform destroy`。
- 执行 `git push --force`。
- 执行 `docker system prune` 等可能影响其他容器的命令。
- 在外网暴露未加密的服务或关闭防火墙规则。

## 三、隐私与数据保护

- 在日志、对话、代码注释中不得输出真实的数据库密码、API Key、AccessKey。你应使用占位符（如 `<RDS_PASSWORD>`）代替。
- 如果必须在终端输出中显示敏感信息（例如错误日志包含了连接字符串），请先询问我是否允许输出。
- 不得将项目中的业务数据（客户名单、订单记录）用于任何测试或训练。

## 四、多 Agent 并行规则（Worktree 隔离）

当需要并行启动多个 Agent 修改代码时：

1. **必须对每个写代码的 Agent 使用 `isolation: "worktree"`**，确保各自在独立 git worktree 中工作，互不覆盖。
2. **只读 Agent（Explore/Plan/审查）不需要 worktree**。
3. **如果两个 Agent 要改相同的文件/模块，禁止并行**，改为串行执行。
4. Agent 完成后 worktree 自动合并。若有冲突，Agent 会报告，由人工处理。

## 五、执行优先级

1. 本规则的自动执行权限高于常规的“每次操作需确认”。
2. 如果你对某个操作是否违反安全红线不确定，**默认拒绝执行，并向我询问**。
3. 我可以随时通过对话中的明确指令覆盖本规则（例如“这次允许你删除那个文件”）。
