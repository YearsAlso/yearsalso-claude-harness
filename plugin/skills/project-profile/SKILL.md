---
name: project-profile
description: 项目档案 — 读取/校验/生成 .claude/project-profile.md（技术栈、gate_commands、文档目录、flags、代码落点）。leader 路由前与各 workflow 起点必读。缺失或不完整时引导 /harness-init 生成。
---

# Project Profile — 项目档案 Skill

## 目的

本插件把"语言/项目差异"全部收敛到一个文件：`<repo>/.claude/project-profile.md`。
agent 与 workflow 不内嵌项目硬编码，一律从 profile 取值，实现一套 harness 服务多项目。

## 使用时机

1. leader 每次路由前
2. 各 workflow 起点（解析 profile 决定 gate 命令、工程师 agent、审查维度）
3. 新项目接入插件时（`/harness-init` 生成本文件）
4. 项目结构演进后（新增模块/改校验命令）→ 更新对应字段

## Profile 字段契约

| 段 | 字段 | 说明 |
|----|------|------|
| stack | `stack` | `go` / `web` / `multi`（多栈按改动落点分派工程师） |
| stack | `engineer_agent` | 实施阶段使用的 agent 名 |
| paths | `spec_dir` / `archive_dir` / `memory_dir` / `docs_dir` | Spec/归档/记忆/文档目录 |
| gate_commands | `build_check` `lint_check` `format_check` `test_command` `race_command` `gate_command` | 验证链与独立门禁命令 |
| conventions | `commit_convention` `comment_language` `naming_strategy` | 提交/注释/命名约定 |
| flags | `alignment_check` `sdd_required` | 可选流程开关（on/off） |
| 栈上下文 | 自由格式 | 框架/UI 库/数据库/代码生成器等项目特化信息 |
| 代码落点 | 表格 | 改动类型 → 实际目录/文件落点 |

## 校验清单（读取后必查）

- [ ] `gate_commands.gate_command` 非空 — 独立测试门禁依赖它，缺失时 workflow 门禁会 fail-closed 中止
- [ ] `engineer_agent` 在插件 agents 中存在（go-backend-engineer / web-frontend-engineer / 自定义）
- [ ] `stack` 与仓库特征文件一致（go.mod / package.json / pnpm-lock.yaml）
- [ ] `flags.alignment_check=on` 时，docs_dir 下确有基线行为记录

不完整时：向用户报告缺失字段，建议重跑 `/harness-init` 或手工补全；在此之前 leader 仅可按
推断栈做裁决 B（单 agent），不启动带测试门禁的 workflow。
