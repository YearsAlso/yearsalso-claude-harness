export const meta = {
  name: 'feature-dev',
  description: '新功能开发（对抗化，多栈通用）— Spec → Spec对抗审查 → Design → Design证伪 → 实施 → 审查(可回流修复) → 测试+独立门禁 → 提交 → 复盘沉淀',
  phases: [
    { title: 'Spec', detail: 'PM 编写需求 Spec（读 pm-memory）' },
    { title: 'SpecCritique', detail: '独立 critic 审查 Spec（完整性/术语统计）' },
    { title: 'Design', detail: '架构师编写 Design（读 architect-memory）' },
    { title: 'DesignCritique', detail: '独立 critic 证伪 Design（grep 核实挂载点）' },
    { title: 'Implement', detail: '语言工程师编码实施（按 profile.engineer_agent）' },
    { title: 'Review', detail: '代码审查（P0 可回流修复）' },
    { title: 'Test', detail: '测试验证 + 独立门禁（gate 真实退出码）' },
    { title: 'Commit', detail: '提交代码' },
    { title: 'Retrospect', detail: '复盘沉淀记忆' },
  ],
}

// ============================================================
// 新功能开发 Workflow（对抗化版本，profile 驱动多栈通用）
// 触发条件：leader 裁决 C + 用户提出新功能需求
// 调用方式：Workflow({ name: 'feature-dev', args: {requirement} })
//
// 对抗化设计（两个来源项目融合后的通用内核）：
//   1. 对抗审查成对 — 产出→独立 critic 证伪→回流修订→重审
//   2. 记忆闭环 — 起点读 {memory_dir}/角色-memory，终点复盘写回
//   3. 独立测试门禁 — 验证器实跑 profile.gate_command，真实退出码
//      fail-closed（解析不出退出码也中止，宁可中止不放行）
//   4. 语言分离 — 项目差异全部收敛在 .claude/project-profile.md：
//      工程师 agent / 审查维度 / gate 命令 / 文档目录 / flags
//
// critic 必须是独立 agent 实例（与产出者不同上下文）。
// 回流上限 MAX_REVISION 防无限循环。
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
const specDir = P('spec_dir', 'docs/specs')
const memoryDir = P('memory_dir', 'docs/memory')
const docsDir = P('docs_dir', 'docs')
const buildCheck = P('build_check', stack === 'go' ? 'go build ./...' : 'pnpm build')
const lintCheck = P('lint_check', stack === 'go' ? 'go vet ./...' : 'pnpm lint')
const formatCheck = P('format_check', stack === 'go' ? 'gofmt -l .' : '')
const testCommand = P('test_command', stack === 'go' ? 'go test ./...' : 'pnpm test')
const raceCommand = P('race_command', stack === 'go' ? 'go test -race ./...' : '')
const gateCommand = P('gate_command', [buildCheck, lintCheck, testCommand].filter(Boolean).join(' && '))
const reviewSkill = P('review_skill', stack === 'go' ? 'go-code-review' : stack === 'web' ? 'frontend-code-review' : '')
const flagsLine = (P('flags') || '')
const alignmentOn = /alignment_check\s*[:：=]\s*on/i.test(flagsLine)
const stackContext = isProfileMissing ? '' : ((profileRaw.match(/##\s*栈上下文([\s\S]*?)(?=\n##|$)/) || ['', ''])[1].trim().slice(0, 1500))
const codeLanding = isProfileMissing ? '' : ((profileRaw.match(/##\s*代码落点([\s\S]*?)(?=\n##|$)/) || ['', ''])[1].trim().slice(0, 1500))

if (isProfileMissing) {
  log('⚠️ 未找到 .claude/project-profile.md — 使用默认值运行，建议先执行 /harness-init；gate 命令可能不准')
}

// 实施/修复 agent 称呼与规则引用
const implLead = engineerAgent ? `作为 ${engineerAgent} agent` : `作为实施工程师 agent（profile 未指定 engineer_agent，按仓库特征栈自行选择插件内 go-backend-engineer / web-frontend-engineer 的职责纪律执行）`
// 工程师类调用统一 opts：agentType 硬绑定插件内按栈工程师 agent（profile 缺失时退回提示词角色）
const engOpts = (label, phase) => engineerAgent ? { label, phase, model: 'sonnet', agentType: `dev-harness:${engineerAgent}` } : { label, phase, model: 'sonnet' }
const alignClause = alignmentOn
  ? `\n  本项目启用行为对齐（alignment_check=on）：对齐基线行为先查 ${docsDir}/ 记录并在文档标注「对齐: <功能点>」，行为差异显式列出；无记录/存疑列入「待确认问题」上报，禁止脑补基线行为。`
  : ''
const raceClause = raceCommand ? `\n  涉及并发/异步的改动额外执行 \`${raceCommand}\`` : ''

const requirement = typeof args === 'string' ? args : (args?.requirement || args?.description || JSON.stringify(args))

// 对抗审查回流上限：critic 判 fail 后允许修订重审的最大轮次
const MAX_REVISION = 2

phase('Spec')
log(`开始 Spec 阶段 — 需求: ${requirement}（栈: ${stack}）`)

// 1. PM 写 Spec（起点读 pm-memory 形成记忆闭环）
let spec = await agent(
  `作为 PM agent，先读取 ${memoryDir}/pm-memory.md 了解需求决策上下文，再为以下需求编写 Spec 文档：
  需求: ${requirement}

  按插件 pm agent 的 Spec 结构（doc-writer skill）输出到 ${specDir}/ 目录。
  只关注"做什么"和"不做什么"，不讨论技术方案。
  命名/术语决策前先 grep 全库统计各叫法出现次数，跟随多数派。${alignClause}`,
  { label: 'PM 写 Spec', phase: 'Spec', model: 'sonnet' }
)

// 2. critic-A：独立审查 Spec（对抗审查成对，可回流修订）
let specApproved = false
for (let round = 1; round <= MAX_REVISION && !specApproved; round++) {
  phase('SpecCritique')
  log(`Spec 对抗审查 — 第 ${round} 轮`)

  const specCritique = await agent(
    `作为独立 critic（与 Spec 产出者不同上下文），使用 critic skill 的对抗审查纪律，证伪式审查 ${specDir}/ 下刚产出的 Spec 文档。

  证伪检查项：
  1. 完整性 — "做什么/不做什么"边界是否清晰？验收标准是否可验证？
  2. 术语核查 — 文中所有命名/文案是否已 grep 全库统计出现次数？是否存在把多数派叫法改成少数派的风险？
  3. 越界检测 — 是否混入技术方案（数据模型/API/迁移 SQL 应留 Design）？${alignmentOn ? `\n  4. 行为对齐 — 对齐基线的需求是否标注功能点？差异是否显式列出？存疑点是否列入待确认而非自行假设？` : ''}
  ${isProfileMissing ? '' : `\n  另对照 ${memoryDir}/critic-checklist.md（若存在）的项目专属必检项。`}

  输出：
  - verdict: pass | fail
  - findings: 按严重度列出问题（含具体位置）
  - 若 fail，给出 PM 必须修订的具体点`,
    { label: 'critic 审 Spec', phase: 'SpecCritique', model: 'sonnet' }
  )

  specApproved = !/verdict\s*[:：]\s*fail/i.test(specCritique)

  if (!specApproved) {
    if (round >= MAX_REVISION) {
      // fail-closed：回流上限耗尽仍未通过 → 中止上报，不得带警告继续（否则未核准的 Spec 会被授权先行实现）
      log('Spec 对抗审查达回流上限仍未通过 — fail-closed 中止，上报用户定夺')
      return { aborted: 'SpecCritique', rounds: round, spec, specCritique }
    }
    log(`Spec 审查未通过（第 ${round} 轮），PM 修订后重审`)
    spec = await agent(
      `作为 PM agent，根据以下 critic 审查意见修订 ${specDir}/ 下的 Spec 文档：
      ${specCritique}

      只修订被指出的问题，不扩大范围。`,
      { label: 'PM 修订 Spec', phase: 'SpecCritique', model: 'sonnet' }
    )
  }
}
log('Spec 对抗审查通过')

phase('Design')
log('进入 Design 阶段')

// 3. 架构师读 Spec 写 Design（起点读 architect-memory 形成记忆闭环）
let design = await agent(
  `作为架构师 agent，先读取 ${memoryDir}/architect-memory.md 了解架构决策上下文，再读取 ${specDir}/ 下的 Spec 文档，编写 Design 文档，输出到 ${specDir}/ 同目录。

  核心原则：
  1. 不质疑 Spec 内容，不增删需求
  2. 覆盖 Spec 全部内容
  3. 三类风险评估（🟢🟡🔴），精确到文件:行号
  4. 遵循项目分层与约定${stackContext ? `（栈上下文：\n${stackContext}）` : ''}
  5. 引用的任何函数/方法/挂载点/事件必须 grep 核实真实存在（曾引用不存在的方法导致缺陷的教训）
    6. 代码落点参照${codeLanding ? ` profile 的「代码落点」表：\n${codeLanding}` : ` 所选栈工程师 agent 的「代码落点速查」`}${alignClause}`,
  { label: '架构师写 Design', phase: 'Design', model: 'sonnet' }
)

// 4. critic-B：独立证伪 Design（对抗审查成对，可回流修订）
let designApproved = false
for (let round = 1; round <= MAX_REVISION && !designApproved; round++) {
  phase('DesignCritique')
  log(`Design 证伪审查 — 第 ${round} 轮`)

  const designCritique = await agent(
    `作为独立 critic（与 Design 产出者不同上下文），使用 critic skill 的对抗审查纪律，证伪式审查 ${specDir}/ 下刚产出的 Design 文档。

  证伪检查项：
  1. 挂载点核实 — 文中引用的每个函数/方法/事件/路由，逐一 grep 源码核实真实存在
  2. 触发路径完备 — 设计事件/订阅时，是否枚举了该事件的全部发布点与消费点？
  3. 分层合规 — 是否违反 profile/规则中的依赖方向与数据访问约定（绕过数据层/手改生成文件）？
  4. 迁移序号 — 新增迁移序号是否与既有迁移目录序号冲突？
  5. 风险评估 — 三类风险是否精确到文件:行号，🟢🟡🔴 分级是否合理？
  6. 边界 — 是否擅自增删了 Spec 需求（Design 阶段禁改需求）？
  ${isProfileMissing ? '' : `7. 项目专属 — 对照 ${memoryDir}/critic-checklist.md（若存在）逐条核验。`}

  输出：
  - verdict: pass | fail
  - findings: 按严重度列出问题（含 grep 核实的硬证据）
  - 若 fail，给出架构师必须修订的具体点`,
    { label: 'critic 证伪 Design', phase: 'DesignCritique', model: 'sonnet' }
  )

  designApproved = !/verdict\s*[:：]\s*fail/i.test(designCritique)

  if (!designApproved) {
    if (round >= MAX_REVISION) {
      // fail-closed：Design 证伪未通过不得进入 Implement
      log('Design 证伪审查达回流上限仍未通过 — fail-closed 中止，上报用户定夺')
      return { aborted: 'DesignCritique', rounds: round, spec, design, designCritique }
    }
    log(`Design 证伪未通过（第 ${round} 轮），架构师修订后重审`)
    design = await agent(
      `作为架构师 agent，根据以下 critic 证伪意见修订 ${specDir}/ 下的 Design 文档：
      ${designCritique}

      只修订被指出的问题，不增删 Spec 需求。`,
      { label: '架构师修订 Design', phase: 'DesignCritique', model: 'sonnet' }
    )
  }
}
log('Design 证伪审查通过')

phase('Implement')
log('进入实施阶段')

// 5. 语言工程师实施（agent 由 profile 指定，实现语言分离路由）
// agentType 硬绑定插件 agent 定义（system prompt/工具约束）；profile 缺失时退回通用 subagent + 提示词角色
const implOpts = engOpts(`${engineerAgent || '工程师'}实施`, 'Implement')
const implementation = await agent(
  `${implLead}，基于 ${specDir}/ 下的 Design 文档实施。

  前置：先读取 ${memoryDir}/${engineerAgent || 'engineer'}-memory.md（不存在则改读 ${memoryDir}/ 下同栈工程师记忆文件，如 backend-engineer-memory.md / frontend-engineer-memory.md），了解历史踩坑与可复用技巧，实施中避开已知坑点。

  开发规范：
  - 遵守插件 rules/universal/ 与 rules/${stack === 'web' ? 'web' : stack === 'go' ? 'go' : '（按栈）'}/ 全部约束
  - 使用${stack === 'go' ? ' go-testing' : stack === 'web' ? ' vitest-testing' : ' 对应栈测试'} skill 编写单元测试（覆盖正常/边界/错误路径）
  - 完成后用 ${reviewSkill || '对应栈 code-review'} skill 自检
  - 验证闭环：\`${buildCheck}\`${lintCheck ? ` && \`${lintCheck}\`` : ''}${formatCheck ? ` && \`${formatCheck}\`` : ''} && \`${testCommand}\` 全部通过${raceClause}

  按 Design 文档的阶段拆解逐步实现。`,
  implOpts
)

// 5b. 实施产物存在性断言（fail-closed）：空 diff 也能过后续门禁的假阳性防线
//     只数代码/配置变更，排除 Spec/Design 文档（前序阶段产物，不构成实施）
const implCheck = await agent(
  `只做一件事，不做任何判断：在仓库根执行 git status --porcelain 与 git diff --stat，统计相对 HEAD 发生新增/修改的**代码/测试/配置文件**数量（排除 .md 文档、docs/ 与 ${specDir}/ 下的 Spec/Design）。输出末尾严格给出：\ncodeChangedFiles: <数字>`,
  { label: '实施产物检查', phase: 'Implement' }
)
const implNMatch = implCheck.match(/codeChangedFiles\s*[:：]\s*(\d+)/i)
if (!implNMatch || Number(implNMatch[1]) === 0) {
  log('实施产物检查：未产生任何代码变更（或无法解析）— fail-closed 中止，不得带空实施进入审查/门禁')
  return { aborted: 'ImplementEmpty', spec, design, implementation, implCheck }
}
log(`实施产物检查通过（代码/测试变更 ${implNMatch[1]} 文件）`)

// 6. Reviewer 审查 + P0 回流修复（对抗审查成对：审查→回流→修复→重审）
let review = ''
let p0Resolved = false
for (let round = 1; round <= MAX_REVISION && !p0Resolved; round++) {
  phase('Review')
  log(`代码审查 — 第 ${round} 轮`)

  review = await agent(
    `作为 reviewer agent，按 ${reviewSkill || '对应栈 code-review'} skill 的维度审查当前 git diff。

  重点维度：正确性（错误处理/边界/解析）、资源与并发安全（锁/recover/清理/异步）、
  安全性（硬编码/注入/鉴权）、可维护性。
  ${alignmentOn ? '行为对齐维度：与已记录基线行为是否一致，差异是否显式标注。' : ''}

  报告 P0/P1/P2 发现（每条含文件:行号，Read/Grep 核实）。输出末尾明确给出：
  - hasP0: yes | no
  - 总体评价: 安全 | 需修改 | 阻塞`,
    { label: 'Reviewer 审查', phase: 'Review', model: 'sonnet' }
  )

  p0Resolved = !/hasP0\s*[:：]\s*yes/i.test(review)

  if (!p0Resolved) {
    if (round >= MAX_REVISION) {
      // fail-closed：P0 未消除不得带着「已上报」继续跑门禁与提交
      log('代码审查达回流上限仍有 P0 — fail-closed 中止，上报用户处理')
      return { aborted: 'Review', rounds: round, spec, design, implementation, review }
    }
    log(`存在 P0（第 ${round} 轮），工程师修复后重审`)
    await agent(
      `${implLead}，修复以下审查发现的 P0 问题：
      ${review}

      只修复 P0，不改动无关代码。修复后用 ${reviewSkill || '对应栈 code-review'} skill 自检并重跑验证闭环。`,
      engOpts('修复 P0', 'Review')
    )
  }
}
log('代码审查通过（无 P0）')

phase('Test')
log('进入测试阶段')

// 7. Tester 测试
const testResult = await agent(
  `作为 tester agent，测试当前变更。

  硬性步骤（不得跳过）：
  0. 先实际执行 \`${testCommand}\`，在报告中引用真实输出作为证据；
     测试未通过时列出失败用例，不得自行判定通过
  1. ${raceCommand ? `若变更涉及并发/异步，追加 \`${raceCommand}\`` : '若项目有专项验证命令（见 profile），一并执行'}
  2. 检查新增代码是否有对应单元测试（无则补上后重跑）

  报告缺陷，输出末尾明确给出：
  - allTestsPassed: yes | no（以实际输出为准）`,
  { label: 'Tester 测试', phase: 'Test', model: 'sonnet' }
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
  { label: '独立测试门禁', phase: 'Test', model: 'sonnet' }
)

const gateExitMatch = gateResult.match(/exitCode\s*[:：]\s*(\d+)/i)
const actualExitCode = gateExitMatch ? Number(gateExitMatch[1]) : null

// 测试门禁（fail-closed）：以下任一条件命中即中止 —
//   1. 独立验证的真实退出码非 0（实际结果优先于 Tester 声明）
//   2. 无法解析出退出码（验证器未实跑或输出异常，宁可中止不放行）
//   3. Tester 自己声明 allTestsPassed: no
if (actualExitCode === null || actualExitCode !== 0) {
  log(`独立门禁：实际退出码 ${actualExitCode ?? '无法解析'} — 中止 workflow，修复后重跑`)
  return { profileMissing: isProfileMissing, spec, design, implementation, review, testResult, gateResult }
}
if (/allTestsPassed\s*[:：]\s*no/i.test(testResult)) {
  log('Tester 声明测试未通过，中止 workflow — 请修复失败用例后重新运行')
  return { profileMissing: isProfileMissing, spec, design, implementation, review, testResult, gateResult }
}
log('测试全部通过（独立验证 exitCode=0），进入提交阶段')

phase('Commit')
log('进入提交阶段')

// 8. Auto-committer 提交
const commit = await agent(
  `作为 auto-committer agent，提交当前变更。

  按项目规范（profile.commit_convention，默认中文 Conventional Commits）生成提交信息：type(scope): 描述
  ${alignmentOn ? '对齐基线行为的附 (贴 <基线> <功能点>)。' : ''}
  注意：不提交构建产物、*.log、本地覆盖配置；git add 指定文件而非 -A。
  范围红线：只提交本次任务直接产生的文件（Spec/Design/代码/测试）；工作区中任务开始前已存在的无关变更（如 .claude/settings.json、插件接入产物）严禁夹带提交，留在工作区并报告。`,
  { label: 'Auto-committer 提交', phase: 'Commit', model: 'sonnet' }
)

phase('Retrospect')
log('进入复盘沉淀阶段')

// 9. 复盘写回记忆（记忆闭环终点；仅写高价值条目）
const retrospect = await agent(
  `作为架构师 agent，复盘本次新功能开发流程，提炼可复用经验写回记忆。

  本次流程关键信息：
  - 需求: ${requirement}
  - Spec 审查结论: ${specApproved ? '一次通过' : '经修订/有争议'}
  - Design 证伪结论: ${designApproved ? '一次通过' : '经修订/有争议'}
  - 代码审查结论: ${p0Resolved ? '无 P0' : '存在 P0 已处理或上报'}

  仅当本次出现以下高价值情况时才写入 ${memoryDir}/，流水账不入：
  1. 被 critic 证伪/抓出的问题模式 → architect-memory.md「经验教训」
  2. 反转的决策（方案拍板后反转） → architect-memory.md「ADR」
  3. 需求边界/基线行为的新认知 → pm-memory.md「经验教训」
  4. ${stack === 'go' ? 'Go 实现级踩坑（并发陷阱、代码生成器用法、协议解析坑等）' : stack === 'web' ? '前端实现级踩坑（Hooks/类型/渲染/样式令牌等）' : '实现级踩坑与可复用技巧'} → ${engineerAgent || 'engineer'}-memory.md

  写入遵循「为什么 + 决策上下文」，不重复记录代码或文档已有信息。
  写入后：将本次新增/修改的记忆文件单独提交（docs(memory): 沉淀 <主题>），不得遗留未提交的记忆改动。`,
  { label: '复盘写回记忆', phase: 'Retrospect', model: 'sonnet' }
)

log('新功能开发 workflow 完成')
return {
  stack,
  profileMissing: isProfileMissing,
  spec,
  design,
  implementation,
  review,
  testResult,
  commit,
  retrospect,
}
