#!/usr/bin/env bash
# commit-review.sh — PreToolUse(Bash) 的 agent hook（if "Bash(git commit*)")：
# 提交前按栈规范审查暂存变更。移植自 daqsvrv5 的提交前 Go 审查 hook，扩展为栈自适应。
# 审查标准来源：.claude/project-profile.md + rules/universal + rules/{stack}
cat <<'EOF'
检查即将提交的 git 变更（git diff --cached 与 git diff）：
1. 读取 .claude/project-profile.md 确定技术栈；无 profile 则按文件扩展名判断。
2. 变更含 .go 文件 → 按插件 go-code-review skill 维度（错误处理/并发安全/资源清理/命名/分层）审查。
3. 变更含 .ts/.tsx 文件 → 按插件 frontend-code-review skill 维度（Hooks 规则/类型安全/三态/样式令牌）审查。
4. 其余文件仅检查是否误提交构建产物、日志、本地覆盖配置。
输出：总体结论（是否建议提交）+ 🔴阻断项 + 🟡警告项 + 🔵建议项；无代码变更则回复"✅ 无代码变更，可以提交"。
EOF
exit 0
