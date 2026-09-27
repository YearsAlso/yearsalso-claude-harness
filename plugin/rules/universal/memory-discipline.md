# 记忆纪律（通用）

记忆文件位于 `docs/memory/`（profile.memory_dir），按角色分文件。

## 读取义务

每次执行关键任务前读取（memory-manager skill 的前置检查）：

1. `.claude/project-profile.md` — 项目档案
2. `.claude/rules/` — 通用 + 栈规则
3. `docs/memory/{role}-memory.md` — 角色记忆
4. 运维/排障会话 additionally 读 `docs/memory/ops-memory.md`

## 写入义务

1. 仅写**高价值条目**：被证伪/反转的决策、根因模式、踩坑、可复用测试/排查模式 — 流水账不入
2. ADR 四要素：时间/决策/原因/后果
3. `superseded-by` 剪枝：反转旧 ADR 时旧条目补标注，**只标注不删除原文**
4. critic 同步：ADR 派生必检项 → 追加到 `docs/memory/critic-checklist.md` 并标「已纳入 critic」，否则标「豁免（理由）」
5. 同主题合并更新，不重复记录；聚焦"为什么 + 决策上下文"，不重复代码/文档已有信息
