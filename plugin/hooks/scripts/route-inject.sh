#!/usr/bin/env bash
# route-inject.sh — UserPromptSubmit：注入路由纪律，保证 leader 是唯一路由权威
# （融合自 daqsvrv5 / tdmversionmanager 两项目 settings.json 的同名 hook，去项目硬编码）
cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"【工作流路由】响应前先判断请求性质：纯运维命令与纯信息咨询 → 直接响应；开发类请求（功能开发/Bug 修复/方案设计等）→ 必须先按 dev-harness 插件的 leader agent 三分法裁决（直接响应/单 agent/workflow），由 leader 作为唯一路由权威解析场景并路由执行，不得跳过路由直接实施；用户显式指定流程优先。项目差异以 .claude/project-profile.md 为准，profile 标记 alignment_check=on 时，基线行为对齐类需求先查 docs/ 记录，无记录上报，禁止脑补。"}}
EOF
exit 0
