---
description: 从来源项目（如 daqsvrv5 / tdmversionmanager）反向同步规则与教训——比对项目 .claude/rules 与 docs/memory，把可泛化条目提炼进插件、把项目专属条目登记 critic-checklist
argument-hint: <来源项目仓库根路径（可多个，空格分隔）>
---

# /sync-rules — 项目 → 插件 反向沉淀

本插件采用双向同步：项目使用 harness 产生的高价值规则/教训，定期回流泛化。

对每个来源项目 `$ARGUMENTS` 执行：

1. **读取**：项目 `.claude/rules/`、`docs/memory/*.md`（重点：ADR、经验教训、误报黑名单）、`.claude/project-profile.md`（若已接入）。
2. **分类比对**每条规则/教训：
   - **可泛化**（跨项目成立）→ 与插件 `rules/universal/` 或对应栈 rules 比对，输出"建议追加的条文 + 目标文件"，经用户确认后编辑插件文件。
   - **项目专属**（分层红线/基线行为/特化命名）→ 保留在项目侧；若 critic 派生必检项缺失，写入项目 `docs/memory/critic-checklist.md`。
   - **已过时**（与插件最新泛化条文冲突）→ 报告冲突，说明取舍理由，请用户定夺。
3. **新项目 profile 草稿**：来源项目尚未接入 harness 时，输出其 profile 草稿（stack/gate_commands/flags 从项目实际配置提取）。
4. 输出同步报告：泛化 N 条 / 专属 N 条 / 冲突 N 条 / 待接入 N 个。

约束：只改用户确认的插件文件；不改来源项目内容（除 critic-checklist 补登外）；泛化条文不得携带来源项目的业务名词。
