#!/usr/bin/env bash
# env-check.sh — SessionStart：检查 project-profile 与关键工具链，缺失时提示（不阻断会话）
# （融合自 tdmversionmanager 的 env-check hook，改为无脚本依赖的 shell 版）
MISSING=()

[ -f .claude/project-profile.md ] || MISSING+=("缺少 .claude/project-profile.md（请执行 /harness-init 生成）")

if [ -f go.mod ] && ! command -v go >/dev/null 2>&1; then
  MISSING+=("Go 仓库但 go 工具链不在 PATH")
fi
if [ -f package.json ] && ! command -v pnpm >/dev/null 2>&1 && ! command -v npm >/dev/null 2>&1; then
  MISSING+=("前端仓库但 pnpm/npm 不在 PATH")
fi
if [ -d docs ] && [ ! -d docs/memory ]; then
  MISSING+=("docs/memory/ 不存在（记忆闭环依赖，可 /harness-init 创建骨架）")
fi

if [ ${#MISSING[@]} -gt 0 ]; then
  printf '{"systemMessage":"🧾 dev-harness 环境体检:\\n%s"}\n' "$(printf '%s\n' "${MISSING[@]}" | sed 's/^/  - /')"
fi
exit 0
