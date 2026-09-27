# CLAUDE.md 接入片段（追加到目标项目 CLAUDE.md）

```markdown
## dev-harness（多 agent 开发框架）

本项目使用 dev-harness 插件（leader 总路由 + 对抗化 workflow + 语言分离 agent/skill/rule）。

- **唯一路由权威**：开发类请求先经 leader agent 三分法裁决（直接响应/单 agent/workflow），
  不得跳过路由直接实施；用户显式指定流程优先。
- **项目档案**：`.claude/project-profile.md` 是语言/命令/目录差异的唯一来源；
  路由与执行前必读，缺失先跑 `/harness-init`。
- **规则**：`.claude/rules/universal/` + `.claude/rules/<stack>/`（由 harness-init 链接）。
- **记忆闭环**：执行前读 `docs/memory/`，workflow 终点仅沉淀高价值条目。
- **门禁红线**：workflow 独立测试门禁以 profile.gate_command 真实退出码为准，
  解析不出退出码也中止；手动提交同样须自查验证链。
- **对齐纪律**（alignment_check=on 时）：基线行为先查 docs/ 记录，无记录上报，禁止脑补。
```
