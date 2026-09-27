#!/usr/bin/env bash
# format-dispatch.sh — PostToolUse(Write|Edit|MultiEdit)：按扩展名分发格式化
#   .go  → gofmt -w（跳过生成目录 gen/ mocks/）
#   .ts/.tsx/.js/.jsx → 依次尝试项目本地 biome / prettier（跳过 node_modules）
# 融合自两项目的同款 hook，统一为一个语言无关分发器。
INPUT=$(cat)
FP=$(printf '%s' "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)
[ -z "$FP" ] || [ ! -f "$FP" ] && exit 0

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0

case "$FP" in
  *.go)
    # 跳过代码生成产物目录
    case "$FP" in */gen/*|*/mocks/*|*node_modules*) exit 0;; esac
    if command -v gofmt >/dev/null 2>&1; then
      gofmt -l "$FP" | grep -q . && gofmt -w "$FP"
    fi
    ;;
  *.ts|*.tsx|*.js|*.jsx|*.css)
    case "$FP" in *node_modules*|*/gen/*|*/mocks/*) exit 0;; esac
    cd "$ROOT" || exit 0
    if [ -x node_modules/.bin/biome ] || [ -f biome.json ] || [ -f biome.jsonc ]; then
      pnpm exec biome format --write "$FP" >/dev/null 2>&1 || true
    elif [ -x node_modules/.bin/prettier ]; then
      ./node_modules/.bin/prettier --write "$FP" >/dev/null 2>&1 || true
    fi
    ;;
esac
exit 0
