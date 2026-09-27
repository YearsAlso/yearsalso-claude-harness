# {role}-memory.md — 角色记忆模板
# 复制到 <repo>/docs/memory/{role}-memory.md。role ∈
# architect | pm | reviewer | tester | go-backend-engineer | web-frontend-engineer | ops

# <角色> 记忆

> 只记「为什么 + 决策上下文」，不重复代码/文档已有信息；流水账不入。

## ADR（仅 architect）

### ADR-001 <决策标题>
- **时间**: YYYY-MM-DD
- **决策**: …
- **原因**: …
- **后果**: …
- **critic 状态**: 已纳入 critic / 豁免（理由）
- **superseded-by**: （被反转时在此补 ADR-XXX — 被取代范围/仍有效部分，不删原文）

## 经验教训

- <被 critic 证伪/反转的认知、踩坑与规避方法；一条一段，附出处 文件:行号>

## 问题模式（仅 reviewer）

- <本项目反复出现的缺陷模式 + 典型 文件:行号 示例，供审查重点盯防>

## 误报黑名单（仅 reviewer）

- <属项目既有约定/无影响写法的"伪问题"，后续审查直接跳过>

## 回归风险点（仅 tester）

- <易漏的回归场景、验证手法、可复用测试模式>

## 排查路径（仅 ops）

- <故障模式 → 排查路径 → 解决方案 的可复用结论>
