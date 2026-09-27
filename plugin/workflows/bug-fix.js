export const meta = {
  name: 'bug-fix',
  description: 'Bug 修复（对抗化，多栈通用）— 根因分析 → 根因证伪 → 修复 → 对抗审查(可回流) → 验证+独立门禁 → 提交 → 复盘沉淀',
  phases: [
    { title: 'Analyze', detail: '分析 Bug 根因（读 architect-memory）' },
    { title: 'RootCauseCritique', detail: '独立 critic 证伪根因（复现/证据链）' },
    { title: 'Fix', detail: '实施修复（先补失败用例，红→绿）' },
    { title: 'Review', detail: '对抗审查（P0 可回流修复）' },
    { title: 'Verify', detail: '验证修复 + 独立门禁（真实退出码 fail-closed）' },
    { title: 'Commit', detail: '提交修复' },
    { title: 'Retrospect', detail: '复盘沉淀根因模式' },
  ],
}

// ============================================================
// Bug 修复 Workflow（对抗化版本，profile 驱动多栈通用）
// 触发条件：leader 裁决 C + 用户报告 Bug
// 调用方式：Workflow({ name: 'bug-fix', args: {Bug描述} })
//
// 对抗化设计：
//   1. 根因证伪 — 独立 critic 质疑根因（是否复现?证据链?有无更深层原因?）
//   2. 审查回流 — 审查→修复→重审，P0 不放过
//   3. 独立测试门禁 — 验证器实跑 profile.gate_command，真实退出码 fail-closed
//   4. 记忆闭环 — 起点读 architect-memory，终点复盘写回根因模式
// ============================================================

// ─── Profile 解析（语言/项目差异唯一来源）───
const profileRaw = await agent(
  `读取仓库根目录的 .claude/project-profile.md（不存在则只输出 MISSING），将文件原文完整返回，不做任何总结或改写。`,
  { label: '读取 project-profile' }
)
const isProfileMissing = /^\s*MISSING\s*$/i.test(profileRaw || '')
const P = (key, fallback = '') => {
  if (isProfileMissing) return fallback
  const m = (profileRaw || '').match(new RegExp('^' + key + '\\s*[:：]\\s*(.+)$', 'im'))
  if (!m) return fallback
  return m[1].replace(/#.*$/, '').trim()
}
const stack = P('stack', 'unknown')
const engineerAgent = P('engineer_agent', stack === 'go' ? 'go-backend-engineer' : stack === 'web' ? 'web-frontend-engineer' : '')
const memoryDir = P('memory_dir', 'docs/memory')
const docsDir = P('docs_dir', 'docs')
const buildCheck = P('build_check', stack === 'go' ? 'go build ./...' : 'pnpm build')
const lintCheck = P('lint_check', stack === 'go' ? 'go vet ./...' : 'pnpm lint')
const testCommand = P('test_command', stack === 'go' ? 'go test ./...' : 'pnpm test')
const raceCommand = P('race_command', stack === 'go' ? 'go test -race ./...' : '')
const gateCommand = P('gate_command', [buildCheck, lintCheck, testCommand].filter(Boolean).join(' && '))
const reviewSkill = P('review_skill', stack === 'go' ? 'go-code-review' : stack === 'web' ? 'frontend-code-review' : '')
const flagsLine = (P('flags') || '')
const alignmentOn = /alignment_check\s*[:：=]\s*on/i.test(flagsLine)
const implLead = engineerAgent ? `作为 ${engineerAgent} agent` : '作为实施工程师 agent（按仓库特征栈选择插件内对应工程师 agent 的职责纪律执行）'
// 工程师类调用统一 opts：agentType 硬绑定插件内按栈工程师 agent（profile 缺失时退回提示词角色）
const engOpts = (label, phase) => engineerAgent ? { label, phase, model: 'sonnet', agentType: `dev-harness:${engineerAgent}` } : { label, phase, model: 'sonnet' }
const testSkill = stack === 'go' ? 'go-testing' : stack === 'web' ? 'vitest-testing' : '对应栈测试'

const bugReport = typeof args === 'string' ? args : (args?.bug || args?.description || JSON.stringify(args))

// 对抗审查回流上限
const MAX_REVISION = 2

phase('Analyze')
log(`开始分析 Bug — ${bugReport}（栈: ${stack}）`)

// 1. 分析根因（起点读 architect-memory 形成记忆闭环）
let analysis = await agent(
  `${implLead}，先读取 ${memoryDir}/architect-memory.md 了解相关历史教训，再分析以下 Bug 的根因：
  Bug 描述: ${bugReport}

  1. 查看相关文件代码
  2. 定位问题文件和行号
  3. 分析根因
  4. 给出修复方案

  输出格式：
  - 文件:行号: 问题描述
  - 根因: 为什么出现
  - 复现证据: 如何确认这就是根因（而非表象）——能写失败测试用例复现的最佳
  - 修复方案: 如何修复
  ${alignmentOn ? `- 若疑似与基线行为不一致：先查 ${docsDir}/ 已记录行为，无记录则标注「基线行为未证实」，不得自行判定对错` : ''}`,
  engOpts('分析 Bug 根因', 'Analyze')
)

// 2. critic：独立证伪根因（对抗审查成对，可回流重析）
let rootCauseConfirmed = false
for (let round = 1; round <= MAX_REVISION && !rootCauseConfirmed; round++) {
  phase('RootCauseCritique')
  log(`根因证伪 — 第 ${round} 轮`)

  const critique = await agent(
    `作为独立 critic（与根因分析者不同上下文），使用 critic skill 的对抗审查纪律，证伪式审查以下 Bug 根因分析：
    ${analysis}

  证伪检查项：
  1. 复现确认 — 是否真正复现了 Bug（测试用例/日志/抓包）？还是仅凭猜测？
  2. 证据链 — 从「现象」到「根因」的推理是否每步都有代码/日志证据？引用的函数/方法是否 grep 核实存在？
  3. 根因深度 — 这是根因还是表象？有没有更深层的原因被忽略（如并发时序、${alignmentOn ? '基线行为理解偏差、' : ''}配置/环境因素）？
  4. 修复对症 — 修复方案是否真正针对根因，还是只掩盖症状？

  输出：
  - verdict: pass | fail
  - findings: 推理链中站不住的环节（含证据）
  - 若 fail，指出需重新分析的方向`,
    { label: 'critic 证伪根因', phase: 'RootCauseCritique', model: 'sonnet' }
  )

  rootCauseConfirmed = !/verdict\s*[:：]\s*fail/i.test(critique)

  if (!rootCauseConfirmed) {
    if (round >= MAX_REVISION) {
      // fail-closed：根因未证伪通过不得进入修复（否则只掩盖症状）
      log('根因证伪达回流上限仍未通过 — fail-closed 中止，上报用户定夺')
      return { aborted: 'RootCauseCritique', rounds: round, analysis, critique }
    }
    log(`根因证伪未通过（第 ${round} 轮），重新分析后重审`)
    analysis = await agent(
      `${implLead}，根据以下 critic 证伪意见重新分析 Bug 根因：
      ${critique}

      原 Bug 描述: ${bugReport}
      针对 critic 指出的薄弱环节补强证据链，必要时修正根因结论。`,
      engOpts('重新分析根因', 'RootCauseCritique')
    )
  }
}
log('根因证伪通过')

phase('Fix')
log('进入修复阶段')

// 3. 实施修复（先补失败用例再修复，红→绿）
const fix = await agent(
  `${implLead}，基于以下已证伪通过的根因分析实施修复：
  ${analysis}

  修复纪律：
  1. 先用 ${testSkill} skill 补一个能复现该 Bug 的失败测试用例（红）
  2. 实施最小修复使其通过（绿），不顺手重构无关代码
  3. 遵守插件 rules/universal/ 与栈规则约束
  4. 修复后重跑 \`${buildCheck}\` && \`${lintCheck}\` && \`${testCommand}\``,
  engOpts('实施修复', 'Fix')
)

// 3b. 修复产物存在性断言（fail-closed）：空 diff 也能过门禁的假阳性防线
const fixCheck = await agent(
  `只做一件事，不做任何判断：在仓库根执行 git status --porcelain 与 git diff --stat，统计相对 HEAD 发生新增/修改的**代码/测试文件**数量（排除 .md 文档）。输出末尾严格给出：\ncodeChangedFiles: <数字>`,
  { label: '修复产物检查', phase: 'Fix' }
)
const fixNMatch = fixCheck.match(/codeChangedFiles\s*[:：]\s*(\d+)/i)
if (!fixNMatch || Number(fixNMatch[1]) === 0) {
  log('修复产物检查：未产生任何代码变更（或无法解析）— fail-closed 中止，不得带空修复进入审查/门禁')
  return { aborted: 'FixEmpty', analysis, fix, fixCheck }
}
log(`修复产物检查通过（代码/测试变更 ${fixNMatch[1]} 文件）`)

// 4. Reviewer 对抗审查 + P0 回流修复（审查→修复→重审）
let review = ''
let p0Resolved = false
for (let round = 1; round <= MAX_REVISION && !p0Resolved; round++) {
  phase('Review')
  log(`修复审查 — 第 ${round} 轮`)

  review = await agent(
    `作为 reviewer agent，按 ${reviewSkill || '对应栈 code-review'} skill 对抗式审查当前 diff 中的 Bug 修复代码。

  重点关注：
  1. 修复是否正确（是否真正解决了根因，而非掩盖症状）
  2. 是否有副作用（修复是否引入了新问题/回归风险，尤其并发与核心数据路径）
  3. 代码质量（错误处理、资源清理、并发/异步安全、类型安全）
  4. 是否覆盖了边界情况
  5. 是否补了复现该 Bug 的回归测试用例

  报告 P0/P1/P2 发现（每条含文件:行号）。输出末尾明确给出：
  - hasP0: yes | no
  - 总体评价: 安全 | 需修改 | 阻塞`,
    { label: '审查修复代码', phase: 'Review', model: 'sonnet' }
  )

  p0Resolved = !/hasP0\s*[:：]\s*yes/i.test(review)

  if (!p0Resolved) {
    if (round >= MAX_REVISION) {
      // fail-closed：P0 未消除不得继续跑验证与提交
      log('修复审查达回流上限仍有 P0 — fail-closed 中止，上报用户处理')
      return { aborted: 'Review', rounds: round, analysis, fix, review }
    }
    log(`存在 P0（第 ${round} 轮），修复后重审`)
    await agent(
      `${implLead}，修复以下审查发现的 P0 问题：
      ${review}

      只修复 P0，不改动无关代码。修复后重跑验证闭环。`,
      engOpts('修复 P0', 'Review')
    )
  }
}
log('修复审查通过（无 P0）')

phase('Verify')
log('进入验证阶段')

// 5. 验证修复
const verify = await agent(
  `作为 tester agent，验证 Bug 修复。

  前置：先读取 ${memoryDir}/tester-memory.md，了解历史测试模式与已知回归点，验证时重点覆盖。

  Bug 描述: ${bugReport}
  修复内容: ${fix}

  硬性步骤（不得跳过）：
  0. 先实际执行 \`${testCommand}\`（含针对修复点的回归用例），在报告中引用真实输出作为证据；
     测试未通过时列出失败用例，不得自行判定通过
  1. ${raceCommand ? `若修复涉及并发/异步，追加 \`${raceCommand}\`` : '若项目有专项验证命令（见 profile），一并执行'}

  补充检查：
  1. 修复逻辑是否正确
  2. 是否覆盖了所有相关场景
  3. 是否有回归风险
  4. 原始复现步骤是否不再触发问题

  输出末尾明确给出：
  - allTestsPassed: yes | no（以实际输出为准）`,
  { label: '验证修复', phase: 'Verify', model: 'sonnet' }
)

// 独立测试门禁：不信任任何 agent 的主观声明，由独立验证器实跑 gate 命令并报告真实退出码
const gateResult = await agent(
  `作为测试门禁验证器，只做一件事（不做任何主观判断）：
  1. 在仓库根目录实际执行 \`${gateCommand}\`
  2. 读取命令的真实退出码（echo $?）
  3. 输出末尾严格给出：
     - exitCode: <真实退出码数字>
     - testSummary: <测试输出末尾的统计/结果行原文>
     - 若退出码非 0：附失败用例或编译错误清单（不超过 10 行）
  禁止在未实际执行命令的情况下报告 exitCode。`,
  { label: '独立测试门禁', phase: 'Verify', model: 'sonnet' }
)

const gateExitMatch = gateResult.match(/exitCode\s*[:：]\s*(\d+)/i)
const actualExitCode = gateExitMatch ? Number(gateExitMatch[1]) : null

// 测试门禁（fail-closed）：真实退出码非 0 / 解析不出退出码 / Tester 声明未通过 — 任一命中即中止
if (actualExitCode === null || actualExitCode !== 0) {
  log(`独立门禁：实际退出码 ${actualExitCode ?? '无法解析'} — 中止 workflow，修复后重跑`)
  return { analysis, review, verify, gateResult }
}
if (/allTestsPassed\s*[:：]\s*no/i.test(verify)) {
  log('验证 agent 声明测试未通过，中止 workflow — 请修复失败用例后重新运行')
  return { analysis, review, verify, gateResult }
}
log('验证全部通过（独立验证 exitCode=0），进入提交阶段')

phase('Commit')
log('进入提交阶段')

// 6. 提交
const commit = await agent(
  `作为 auto-committer agent，提交 Bug 修复。

  提交信息格式: fix(scope): 修复描述（以 profile.commit_convention 为准）。使用中文。
  范围红线：只提交本次修复直接产生的文件（修复代码/回归测试）；工作区中任务开始前已存在的无关变更严禁夹带，留在工作区并报告。`,
  { label: '提交修复', phase: 'Commit', model: 'sonnet' }
)

phase('Retrospect')
log('进入复盘沉淀阶段')

// 7. 复盘写回记忆（仅写高价值条目：根因模式、被证伪的误判）
const retrospect = await agent(
  `作为架构师 agent，复盘本次 Bug 修复流程，提炼可复用经验写回记忆。

  本次流程关键信息：
  - Bug: ${bugReport}
  - 根因证伪结论: ${rootCauseConfirmed ? '一次通过' : '经重析/有争议'}
  - 修复审查结论: ${p0Resolved ? '无 P0' : '存在 P0 已处理或上报'}

  仅当本次出现以下高价值情况时才写入 ${memoryDir}/，流水账不入：
  1. 根因模式（这类 Bug 的共性根因/排查路径）→ architect-memory.md「经验教训」
  2. 被 critic 证伪的误判（一开始判断错误的根因）→ architect-memory.md「经验教训」
  3. 反复出现的回归风险点 → architect-memory.md「经验教训」
  4. 可复用的测试模式（验证手法、易漏的回归场景）→ tester-memory.md

  写入遵循「为什么 + 决策上下文」，不重复记录代码已有信息。
  写入后：将本次新增/修改的记忆文件单独提交（docs(memory): 沉淀 <主题>），不得遗留未提交的记忆改动。`,
  { label: '复盘写回记忆', phase: 'Retrospect', model: 'sonnet' }
)

log('Bug 修复 workflow 完成')
return {
  stack,
  analysis,
  review,
  verify,
  commit,
  retrospect,
}
