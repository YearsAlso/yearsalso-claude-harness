# Project Profile — 项目档案模板
# 复制到目标仓库 <repo>/.claude/project-profile.md 后由 /harness-init 填写。
# workflow/leader/hooks 都以本文件为语言/项目差异的唯一来源。
# 字段格式：`key: value` 一行一键（workflow 正则解析），值后 # 为注释。

stack: go                      # go | web | multi
engineer_agent: go-backend-engineer   # multi 时写"按落点分派"并在栈上下文说明
review_skill: go-code-review   # go→go-code-review，web→frontend-code-review

# ─── 文档目录 ───
spec_dir: docs/specs
archive_dir: docs/specs/archive
memory_dir: docs/memory
docs_dir: docs

# ─── 验证链与独立门禁（必须真实可执行；gate_command 供独立门禁实跑）───
build_check: go build ./...
lint_check: go vet ./...
format_check: gofmt -l .
test_command: go test ./...
race_command: go test -race ./...
gate_command: go build ./... && go vet ./... && go test ./...

# ─── 约定 ───
commit_convention: 中文 Conventional Commits，type(scope): 描述；scope 取模块名
comment_language: 中文
naming_strategy: rules/go/naming-zero-style.md

# ─── 可选流程开关 ───
flags: alignment_check=off sdd_required=on
# alignment_check=on 适用于重写/迁移项目：基线行为查证、对齐标注、差异确认全流程生效

## 栈上下文

<!-- 自由格式：框架/数据库/代码生成器/日志库/生命周期契约 等。
     示例（Go 边缘网关）：Go 1.24+，Gin + gorilla/websocket，PostgreSQL+sqlc，
     模块实现 base.Module(Init/Start/Stop) 由 Supervisor 统一启停，
     EventBus 事件集中在 entity/events.go。
     示例（Web 管理后台）：React 19 + TS + Vite + Tailwind4 + Radix/shadcn，
     Bun/Elysia + Drizzle，包管理 pnpm，格式化 biome。-->

## 代码落点

<!-- 表格：改动类型 → 实际目录/文件。示例：
| 新 REST API | internal/northbound/handler/ + register/*.go |
| 新 DB 查询  | repository/queries/*.sql → sqlc generate → gen/ |
| 表结构变更  | repository/migrations/NNN_名称.up/.down.sql（序号顺延）|
| 新页面      | src/renderer/src/pages/{feature}/ |
-->

## 项目红线

<!-- 本项目特有禁止项（如：不提交 bin/*.log/本地覆盖配置；CGO 依赖变更需确认；
     路由路径与 JSON tag 是前端契约禁止改动）。通用红线已在 rules/ 内，勿重复。-->
