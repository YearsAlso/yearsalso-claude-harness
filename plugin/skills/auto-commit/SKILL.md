---
name: auto-commit
description: 规范化提交 — 按项目 profile 约定的提交信息风格生成提交信息并提交。提交代码前使用；提交前必须已过测试门禁。
---

# Auto-Commit Skill

## 提交信息格式（默认模板，实际以 profile.commit_convention 为准）

```
<type>(<scope>): <中文简短描述>
```

- **type**: `feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `chore` | `ci` | `build`
- **scope**: 改动落点对应的模块名（profile 可枚举；未枚举取顶层目录名）
- profile `flags.alignment_check=on` 时，对齐基线行为的提交附 `(贴 <基线> <功能点>)`

## 步骤

1. `git status` + `git diff --stat` 确认变更范围
2. 读关键 diff 理解变更性质，选准 type/scope
3. `git add <具体文件>`（**禁止 `-A` 全量添加**）
4. `git commit -m "<信息>"`（不跳过 git hooks）
5. 报告提交 SHA

## 提交前门禁

提交前必须满足（workflow 中已由独立门禁验证真实退出码；手动提交时自查）：
- profile `gate_commands.build_check` 通过
- `lint_check` 无告警
- `test_command` 全部通过

## 禁止项

- 不提交构建产物（bin/、dist/）、`*.log`、本地覆盖配置
- 不 amend / rebase 已推送的提交
- 不跳过 git hooks（`--no-verify` 禁用）
