# 多角色团队 — 使用说明

## 怎么启动

每个角色是独立的 Claude Code 实例。在终端中：

```bash
# 终端 1 — 产品经理
cd /Users/apple/garment-crm-saas
claude --claude-md .claude/roles/product-manager.md

# 终端 2 — 架构师
cd /Users/apple/garment-crm-saas
claude --claude-md .claude/roles/architect.md

# 终端 3 — 后端
cd /Users/apple/garment-crm-saas
claude --claude-md .claude/roles/backend-dev.md

# 终端 4 — 前端
cd /Users/apple/garment-crm-saas
claude --claude-md .claude/roles/frontend-dev.md

# 终端 5 — 代码审查
cd /Users/apple/garment-crm-saas
claude --claude-md .claude/roles/code-reviewer.md

# 终端 6 — 运维
cd /Users/apple/garment-crm-saas
claude --claude-md .claude/roles/devops.md
```

**实际建议**：先开 2-3 个，不要全开——6 个终端切来切去很累。按需启动，用完关掉。

## 典型工作流

1. **你有想法** → 丢给 PM：「分析一下律师行业外呼场景的合规风险」
2. **PM 出分析** → 丢给架构师：「基于这个分析，设计系统方案」
3. **架构师出方案** → 丢给后端/前端：「按这个实现」
4. **代码提交后** → 丢给审查员：「审查刚才的提交」
5. **需要上线** → 丢给运维：「部署到生产」

**关键**：你是信息路由，角色之间不互相对话。你在中间翻译、判断、决策。

## 角色不是独立 AI

每个角色是同一个 Claude Code，只是被不同的 CLAUDE.md 约束了行为边界。它们没有自己的记忆——每次对话独立，不会「记住」上次 PM 说了什么。你要负责把上下文传给下一个角色。

## 如果某个角色越界

直接说：「你是 X，这个归 Y。请回到你的边界内。」角色说明书里写了边界，Claude Code 会遵守。

## 可以不用的角色

以下角色在 MVP 阶段可能不需要独立实例：
- **代码审查** — 可以让后端/前端互相审查
- **运维** — 初期你自己手动部署就行

核心四个：PM → 架构师 → 后端 + 前端。运维和审查按需启动。
