#!/usr/bin/env bash
# safety-guard.sh — PreToolUse(Bash)：拦截危险命令（exit 2 = 阻断并反馈给模型）
# 读取 stdin 的 hook JSON，提取 tool_input.command
INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)
[ -z "$CMD" ] && exit 0

# 黑名单可按需扩展；命中即阻断
if printf '%s' "$CMD" | grep -qE 'rm -rf (/[^a-zA-Z~]|$)|git push -f(orc-e)? *(-[a-zA-Z]+ )*(main|master)|git reset --hard|DROP (TABLE|DATABASE)|TRUNCATE |mkfs|\bshutdown\b|chmod -R 777 /'; then
  echo "BLOCKED(dev-harness safety-guard): 高危命令已被拦截，请向用户确认后手动执行 — $CMD" >&2
  exit 2
fi
exit 0
