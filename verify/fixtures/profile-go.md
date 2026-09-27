# Project Profile — 验证夹具（Go 栈）
# CI/无真实仓库时 dry-run.mjs 回退使用；字段值即干跑断言的期望值。
# 格式契约与 plugin/templates/project-profile.md 一致（key: value，# 为注释）。

stack: go
engineer_agent: go-backend-engineer   # 夹具
review_skill: go-code-review

# ─── 文档目录 ───
spec_dir: docs/specs
archive_dir: docs/specs/archive
memory_dir: docs/memory
docs_dir: docs

# ─── 验证链与独立门禁 ───
build_check: go build ./...
lint_check: go vet ./...
format_check: gofmt -l .
test_command: go test ./...
race_command: go test -race ./...
gate_command: scripts/check.sh

# ─── 约定 ───
commit_convention: 中文 Conventional Commits，type(scope): 描述
comment_language: 中文
naming_strategy: rules/go/naming-zero-style.md

# ─── 可选流程开关 ───
flags: alignment_check=on sdd_required=on

## 栈上下文

夹具：Go monorepo（go.work 多模块），Gin + pgx/sqlc。

## 代码落点

| 改动类型 | 实际目录/文件 |
|----------|---------------|
| 新 REST API | internal/api/handler/ + logic/ |
| 新 DB 查询 | repository/queries/*.sql → gen/ |

## 项目红线

- 夹具红线：禁止手改 gen/
