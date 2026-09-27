# Project Profile — 验证夹具（Web/TS 栈，multi）
# CI/无真实仓库时 dry-run.mjs 回退使用；字段值即干跑断言的期望值。
# 格式契约与 plugin/templates/project-profile.md 一致（key: value，# 为注释）。

stack: multi
engineer_agent: web-frontend-engineer   # server 与 web 均为 TypeScript，统一解析到本 agent
review_skill: frontend-code-review

# ─── 文档目录 ───
spec_dir: specs/active
archive_dir: specs/archive
memory_dir: docs/memory
docs_dir: docs

# ─── 验证链与独立门禁 ───
build_check: pnpm build
lint_check: pnpm lint
format_check: pnpm biome format
test_command: pnpm test
race_command:                            # TODO 无 Go 栈，无 race 等价物（注释须被解析剥离）
gate_command: pnpm ci:check

# ─── 约定 ───
commit_convention: 中文 Conventional Commits，type(scope): 描述
comment_language: 中文
naming_strategy: .claude/skills/naming-check/SKILL.md

# ─── 可选流程开关 ───
flags: alignment_check=on sdd_required=on

## 栈上下文

夹具：pnpm workspace（web: React+TS+Vite；server: Bun+Elysia+Drizzle）。

## 代码落点

| 改动类型 | 实际目录/文件 |
|----------|---------------|
| 新页面 | src/renderer/src/pages/{feature}/ |
| 新 API | server/src/routes/ |

## 项目红线

- 夹具红线：路由路径与 JSON tag 是前端契约禁止改动
