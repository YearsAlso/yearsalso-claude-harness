---
description: 把本机某项目里的重型知识库 skill（如 gopl-programming-language 全书知识卡）安装到用户级 ~/.claude/skills/，供插件索引桩对接
argument-hint: <源 skill 目录路径，如 .../daqsvrv5/.claude/skills/gopl-programming-language>
---

# /add-book-ref — 安装重型知识卡

插件内分发大体积书籍/文档知识卡不合适（体积与授权），因此插件只带**索引桩**
（`skills/gopl-programming-language/SKILL.md`），全文知识卡由本命令按需安装到用户级。

步骤：
1. 校验 `$1` 目录存在且含 `SKILL.md`；读取其 name 作为 skill 名。
2. `mkdir -p ~/.claude/skills/<name>`，将源目录**完整复制**过去（已存在时先 diff 报告差异，询问覆盖/合并/跳过）。
3. 验证：`ls ~/.claude/skills/<name>/` 输出文件清单；提示重启会话后 user 级 skill 生效。
4. 报告：索引桩 → 全文知识卡的映射已可用（agent 引用同名 skill 时自动升级到完整版）。
