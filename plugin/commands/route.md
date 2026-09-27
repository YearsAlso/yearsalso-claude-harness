---
description: 显式请求 leader 路由——对 $ARGUMENTS 做三分法裁决（直接响应/单 agent/workflow）并给出裁决理由与路由结果
argument-hint: <需求/Bug/请求描述>
---

# /route — 显式路由

将以下内容作为 leader agent 的输入，要求其严格执行 leader.md 的两级裁决并汇报：

用户请求：$ARGUMENTS

执行要求：
1. 先读 `.claude/project-profile.md`（缺失则注明并按默认值/推断栈处理）。
2. 输出**第一裁决**（直接响应 A / 单 agent B / workflow C）+ 一句话理由（命中了裁决表中的哪条特征）。
3. 若为 C：给出第二裁决结果（workflow 名 + args），经用户确认后调用 Workflow 执行；用户已在命令中说明"直接执行"则可跳过确认。
4. 若为 B：说明调用哪个 agent 及其职责范围，然后执行。
5. 若为 A：直接回答。
6. 禁止在 B/C 边界模糊时自作主张——报告两种方案的成本/风险差异请用户定夺。
