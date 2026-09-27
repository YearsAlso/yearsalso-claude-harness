---
name: memory-manager
description: 记忆管理 — 负责读取/写入/更新项目记忆文件（docs/memory/），实现反思机制。供各角色在执行任务前反思、执行后更新记忆。
---

# Memory Manager — 记忆管理 Skill

## 概述

管理项目记忆文件（`docs/memory/`），确保每次执行前有上下文，执行后有沉淀。
记忆按角色分文件：`{role}-memory.md`（architect / pm / reviewer / tester /
go-backend-engineer / web-frontend-engineer / ops）。

## 前置检查

执行任何关键任务前，按以下顺序读取：

1. **项目档案** → `.claude/project-profile.md`（栈、校验命令、专属红线）
2. **项目规则** → `.claude/rules/`（universal + 栈规则包）
3. **项目指引** → `CLAUDE.md`
4. **角色记忆** → `docs/memory/{role}-memory.md`
5. **全部记忆** → `docs/memory/` 下所有 `.md` 文件

## 反思步骤

```
[读取记忆] → [判断上下文] → [调整方向] → [执行任务] → [更新记忆]
```

### 1. 读取记忆
重点关注：
- 之前的架构决策（ADR）— 避免推翻已有决策
- 「经验教训」节 — 避开已知坑点
- reviewer-memory 误报黑名单 — 审查时跳过既有约定
- tester-memory 回归风险点 — 测试时重点覆盖
- 带 `superseded-by` 标注的条目 — 以新决策为准，旧条目仅作历史参考

### 2. 判断上下文
当前任务是否与记忆中的决策/教训相关？相关则在执行中显式规避。

### 3. 执行后更新记忆
仅写**高价值条目**，流水账不入：
- 被 critic 证伪/反转的决策 → architect-memory「经验教训」或「ADR」
- 根因模式、实施踩坑、可复用测试模式 → 对应角色记忆
- 需求边界、基线行为确认结论 → pm-memory
- 运维/排障可复用结论（故障模式、排查路径、解决方案）→ ops-memory

## 写入规范

1. **为什么 + 决策上下文** — 不重复记录代码/文档已有信息
2. **ADR 四要素** — 时间/决策/原因/后果
3. **superseded-by 剪枝** — 新决策反转旧 ADR 时，在旧条目补
   `- **superseded-by**: ADR-XXX — 被取代范围/仍有效部分`，只标注不删除原文
4. **critic 同步** — 新增 ADR 派生必检项时同步 critic 项目检查项
   （`docs/memory/critic-checklist.md`）并标记「已纳入 critic」；无需派生标记「豁免」
5. **合并更新** — 已存在的同主题条目做合并，不重复记录
6. **记忆聚焦"为什么"和"决策上下文"**，而非"是什么"
