---
description: 为当前项目接入 dev-harness：探测技术栈、生成 .claude/project-profile.md、建立 rules 链接、创建 docs/memory 骨架
argument-hint: [可选：go|web|multi，不填则自动探测]
---

# /harness-init

在当前项目仓库执行 dev-harness 接入初始化。按以下步骤逐项完成并汇报：

1. **探测栈**：检查 `go.mod` / `package.json` / `pnpm-lock.yaml` / 特征目录；用户传入 `$1` 时以传入值为准。
2. **生成 profile**：读取插件模板 `templates/project-profile.md`（优先 `${CLAUDE_PLUGIN_ROOT}/templates/project-profile.md`，找不到时用 Glob 在插件目录内定位 `project-profile.md` 模板），按探测结果填写：
   - `stack` / `engineer_agent`（go→go-backend-engineer，web→web-frontend-engineer，multi→按落点分派并写明）
   - `gate_commands`：从 Makefile / package.json scripts / CI 配置中提取真实的 build/lint/format/test/gate 命令，**逐条向用户确认**后写入；确认不了的空着并标注 TODO
   - `paths`：spec_dir / archive_dir / memory_dir / docs_dir（默认 docs/specs、docs/specs/archive、docs/memory、docs）
   - `flags`：询问项目是否为重写/行为对齐项目 → `alignment_check: on/off`；是否强制 SDD → `sdd_required`
   - 「栈上下文」「代码落点」两段：扫描目录结构后给出草稿，请用户修订
3. **写入** `.claude/project-profile.md`（已存在时展示 diff 并询问合并方式，不静默覆盖）。
4. **链接规则包**：创建 `.claude/rules/` 目录结构 `universal/`+ 对应栈目录，将插件 `rules/` 下适用文件复制为符号链接（失败则复制）；询问用户是否有项目专属规则需要补充。
5. **记忆骨架**：创建 `docs/memory/` 与 `{role}-memory.md` 空模板（用插件 `templates/memory-file.md`）。
6. **CLAUDE.md 片段**：输出插件 `templates/claude-md-snippet.md` 内容，询问用户追加到项目 CLAUDE.md。
7. 最后运行一次轻量自检：读回 profile，校验 project-profile skill 的字段清单，报告缺失项。

结束时输出接入摘要：哪些已就绪、哪些待用户补充、下一步建议（跑一次小 bug-fix 验证链路）。
