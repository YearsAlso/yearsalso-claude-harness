# yearsalso-claude-harness

**中文** | [English](README.en.md)

自用的一套 Claude Code 框架 harness 工程。核心是 `plugin/` 下的 **dev-harness** 插件——
由 `daqsvrv5`（Go 边缘网关）与 `tdmversionmanager`（TS/React 全栈）两个项目的
`.claude/` 资产融合泛化而来，不再绑定单一语言/单一项目。

## 设计总纲

1. **leader 是唯一路由权威**：所有开发类请求先经 leader 两级裁决——
   - 第一裁决（是否走 workflow）：A 直接响应 / B 单 agent / C workflow 三段流水线，
     附量化判据（改动文件数、角色交接数、错误代价），边界模糊时上报用户定夺；
   - 第二裁决（走哪条 workflow）：8 条 workflow 路由决策表。
2. **语言分离**：实施类 agent / skill / rule 按栈拆分为 `go-*` 与 `web-*`，
   不再用单一工程师 agent 混写多语言；共享角色（leader/pm/architect/reviewer/tester/
   auto-committer）语言无关。
3. **project-profile 收敛差异**：技术栈、gate 命令、文档目录、可选流程开关
   （`alignment_check` 行为对齐、`sdd_required`）全部写进目标仓库的
   `.claude/project-profile.md`；workflow 运行时先读 profile，按 `stack` 切换
   工程师 agent、审查维度、验证命令——这是两个来源项目能合并为一套的机制核心。
4. **保留对抗化 workflow 内核**（来自 daqsvrv5 的重设计版本）：
   - 产出 → **独立 critic 证伪** → 回流修订（MAX_REVISION=2，超限上报用户）
   - **独立测试门禁 fail-closed**：验证 agent 实跑 gate 命令回报真实退出码，
     不信任任何 agent 的主观声明，解析不出退出码也中止
   - **记忆闭环**：起点读 `docs/memory/`，终点仅沉淀高价值条目（ADR/根因模式/踩坑）
5. **hooks 通用化**（来自两项目 settings.json 融合）：路由提示注入、危险命令拦截、
   按扩展名分发格式化（gofmt/biome/prettier）、提交前栈规范审查（agent hook）、
   会话环境体检。

## 目录结构

```
.claude-plugin/          marketplace 清单（yearsalso）
plugin/
├── .claude-plugin/plugin.json
├── agents/              # 共享角色 + 语言分离工程师
│   ├── leader.md        # ★ 两级裁决（是否走 workflow + 路由表）
│   ├── pm.md / architect.md / reviewer.md / tester.md / auto-committer.md   # 语言无关
│   ├── go-backend-engineer.md   # Go 栈实施（rules/go + go-testing/go-code-review）
│   └── web-frontend-engineer.md # TS/React 栈实施（rules/web + react/vitest/ts-check）
├── skills/
│   ├── critic/ memory-manager/ project-profile/ doc-writer/ auto-commit/     # 共享
│   ├── go-testing/ go-code-review/ gopl-programming-language/(索引桩)        # Go 栈
│   └── react-coding/ tailwind-coding/ frontend-code-review/ ts-check/ vitest-testing/  # Web 栈
├── rules/
│   ├── universal/       # ask-dont-assume / sdd-risk-and-alignment / memory-discipline / no-god-files
│   ├── go/              # go-code / naming-zero-style
│   └── web/             # feature-scoped-handlers / app-scope-guard
├── workflows/           # ★ profile 驱动的对抗化流水线（见下表）
├── hooks/               # hooks.json + scripts/（shell 实现，${CLAUDE_PLUGIN_ROOT} 寻址）
├── commands/            # harness-init / route / add-book-ref / sync-rules
└── templates/           # project-profile / memory-file / claude-md-snippet
verify/
├── check.sh             # 本地/CI 共用自检入口（四步全检）
├── dry-run.mjs          # 干跑回归：stub 运行时 + 真实/夹具 profile 驱动 workflow 源码
└── fixtures/            # profile 夹具（源仓库不可达时自动回退，如 CI）
.github/workflows/ci.yml # 见「自证：自检与 CI」
```

## Workflow 一览

调用方式统一为 `Workflow({ name: '<dev-harness:名称>', args })`；日常不由你直接发起，
而是 leader 第二裁决路由表选中后执行（也可显式指定绕过裁决）。所有写产物的 workflow
运行时先读 `.claude/project-profile.md`，按 stack 切换工程师 agent / 审查维度 / gate 命令。

| workflow | 阶段链（实测 meta） | args | fail-closed 点 | 来源 |
|----------|---------|------|-------------|------|
| `feature-dev` | Spec → SpecCritique → Design → DesignCritique → Implement → Review → Test → Commit → Retrospect | `{requirement}` | Spec/Design 证伪超限中止；实施产物存在性断言；P0 未消中止；门禁 exitCode 非 0/解析不出中止 | daqsvrv5 对抗化版，profile 化 |
| `bug-fix` | Analyze → RootCauseCritique → Fix → Review → Verify → Commit → Retrospect | `{bug}`（现象+复现路径） | 根因证伪超限中止；修复产物存在性断言；P0 未消中止；独立门禁同上 | daqsvrv5 对抗化版，profile 化 |
| `code-review` | ParallelReview → Dedup → AdversarialFilter → Report → Persist | diff 范围/关注点描述 | 无提交动作；critic 逐条证伪去误报后分级，P0 单独点名 | daqsvrv5 增强版，维度按 stack |
| `design-doc` | Clarify → Design → DesignCritique → Retrospect | 需求/难题描述 | 回流超限时带警告交付（纯文档产物无实施风险），日志两态区分 | daqsvrv5 |
| `design-eval` | Analyze → Evaluate → Report | 待评方案路径/描述 | 无（评估报告型） | tdmversionmanager |
| `refactor-mechanical` | Plan → Execute → Verify | 重构目标（仅限机械性：改名/搬家/依赖升级） | Verify 阶段完整性核对 + 门禁实跑引用真实输出 | tdmversionmanager，补门禁 |
| `doc-tidy` | Scan → Tidy → Update | 可缺省（周期扫描） | 无（只归档不删除，superseded-by 剪枝） | 两项目融合 |
| `deep-research` | Scope → Search → Fetch → Verify → Synthesize | `<问题字符串>`（需具体） | 每条断言 3 票对抗验证，2/3 反驳才剔除 | daqsvrv5（语言无关原样移植） |

选型速记（leader 第二裁决的简化视图）：新功能→`feature-dev`；缺陷修复→`bug-fix`；
只看代码不改→`code-review`；要出设计方案→`design-doc`；评已有方案→`design-eval`；
机械重构→`refactor-mechanical`；文档/记忆老化→`doc-tidy`；外部技术调研→`deep-research`。

> **fail-closed 内核说明**（v0.1.1，由双项目实跑验证打磨）：门禁不是只有一处——
> 证伪回流超限、实施/修复产物为空（`codeChangedFiles: 0` 或解析不出）、
> 独立验证器实跑 gate 退出码非 0 或解析不出，均在提交前中止并上报，宁停不放。

## 融合取舍记录

- **单 agent 拆分**：原两项目各有一个混语言倾向的工程师 agent → `go-backend-engineer` /
  `web-frontend-engineer`；`backend/frontend` 命名改为 `go-/web-` 前缀，语言归属显式化。
- **technical-research（tdm）被 deep-research（daqsvr）取代**：前者多源扇出+证伪 weaker 版本；
  本地栈选型调研由 `design-doc` + 架构师 agent 覆盖（leader 裁决 B 可单 agent 直答小调研）。
- **daqsvrv5 专属**（v4 对齐、sqlc/EventBus 路径、迁移序号）→ 泛化为
  `alignment_check` flag + profile「栈上下文/代码落点/项目红线」段。
- **tdm 专属**（prototype-readonly、web-app-scope、Bun/Elysia 细节）→ 泛化为
  `rules/web/app-scope-guard.md`（范围声明入 profile）。
- **gopl 全书知识卡不进插件**（体积/授权）：插件带索引桩，`/add-book-ref` 从本机项目安装完整版。
- **openspec / api-mock / i18n / pr-watcher / test-gen / migrator 等低频资产未融合**，
  保留在原项目，作为插件后续扩展点。

## 自证：自检与 CI

本仓库对自己的质量门禁与插件倡导的纪律一致（可验证、fail-closed、不信任声明）：

```bash
# 本地一条命令跑全部四步（与 CI 同入口）
bash verify/check.sh

# 只跑干跑回归（真实 profile；CI 上自动回退到 verify/fixtures/ 夹具）
node verify/dry-run.mjs
```

`verify/check.sh` 四步：

1. **清单校验**：marketplace.json / plugin.json / hooks.json 合法 JSON，关键字段（name、
   plugins[].source、semver 版本号）齐全；
2. **hooks**：全部脚本 `bash -n` + 可执行位，hooks.json 引用的脚本真实存在；
3. **workflows**：逐个 JS 按运行时等效方式（async 函数体包裹）做语法检查；
4. **干跑回归**：`dry-run.mjs` stub 掉 agent/phase/log 运行时，用真实（或夹具）profile
   驱动 workflow 源码，断言：字段契约解析、按栈工程师 agent 硬绑定（agentType）、
   gate 命令注入、alignment/race 条款开关，以及 6 种门禁/假阳性场景（exit 0/1/不可解析、
   空实施、critic 持续 fail、P0 持续存在）全部正确中止或放行。

GitHub Actions（`.github/workflows/ci.yml`）两个 job，push（main/master）与 PR 触发：

| job | 内容 |
|-----|------|
| `verify` | Node 22 下跑 `bash verify/check.sh`（干跑自动走夹具模式，不依赖本机私有仓库） |
| `marketplace-smoke` | 安装 claude CLI，`claude plugin marketplace add` 本仓库验证 marketplace 可被真实 CLI 注册解析 |

发版提醒：同版本号不会刷新插件缓存（实跑踩实）——改完 `plugin/` 必须同步 bump
`plugin/.claude-plugin/plugin.json` 与 `.claude-plugin/marketplace.json` 两处 version，
下游才能 `claude plugin update` 拉到新包（check.sh 第 1 步会校验 semver 格式）。

## 安装与接入

```bash
# 1. 注册本仓库为 marketplace（clone 到本机后）
claude plugin marketplace add /path/to/yearsalso-claude-harness
# 2. 安装插件
claude plugin install dev-harness@yearsalso
# 3. 在每个目标项目接入（生成 profile + 链接规则 + 记忆骨架）
#    项目内执行：/harness-init
# 4. 定期把项目沉淀的规则回流插件
#    /sync-rules <项目A路径> <项目B路径>
```

## 新增一个语言栈（如 Python）的扩展路径

1. `agents/py-<role>-engineer.md`（照 go-/web- 的结构：使用 skill 表 + 实施纪律 + 验证闭环）
2. `skills/py-*/`（测试、审查维度两个必备 skill）
3. `rules/py/` 规则包
4. workflow 的 `DIMS_BY_STACK` / profile 默认值映射中补 `py` 分支——共享骨架零改动。

## 真实项目验证记录（v0.1.1）

已在 daqsvrv5（Go）与 tdmversionmanager（TS/React）双项目完成安装→/harness-init→feature-dev 实跑全链路验证，并用 `verify/dry-run.mjs`（Node 干跑器，stub 运行时 + 真实 profile，165 断言）做回归。

实跑抓出并已在 0.1.1 修复的缺陷：

| 缺陷 | 修复 |
|---|---|
| `engineer_agent` 只拼提示词（软路由），插件 agent 定义未生效 | 工程师类调用透传 `opts.agentType: dev-harness:<agent>`（硬绑定，已经运行时 spike 证实落入 subagent meta.json） |
| 对抗审查回流上限耗尽后仍无条件日志「通过」并带警告继续（未核准 Spec 被授权先行实现） | Spec/Design/根因证伪/P0 审查达上限一律 fail-closed 中止上报（design-doc 保留带警告交付，但日志区分两态） |
| Implement 被合法 BLOCKED 后空 diff 照样过 exit-0 门禁并提交（exit-0 只证明无回归不证明交付） | Implement/Fix 后新增「产物存在性断言」：`codeChangedFiles` 解析不出或为 0 → fail-closed 中止 |
| Commit 夹带任务前已存在的无关变更；Retrospect 记忆写入滞留工作区 | 提交 prompt 加范围红线；复盘后记忆文件单独 `docs(memory):` 提交 |
| flags 解析式与模板契约 `key=value` 不兼容（alignment_check=on 被静默忽略）+ 注释行可误触发 | `[:：=]` 三态分隔符且仅在 flags 行内解析 |

环境注意（非插件缺陷但影响使用）：

- headless（`claude -p`）对 `.claude/` 敏感目录写入有硬护栏，/harness-init 产物需从临时路径落位或交互式授权。
- project 作用域安装的插件 agent 只在注册仓库内可解析；在其 git worktree 中 `agentType` 可能解析失败，跨 worktree 用 user 作用域安装。
