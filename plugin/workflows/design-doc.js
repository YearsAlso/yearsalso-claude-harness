export const meta = {
  name: 'design-doc',
  description: '方案设计（对抗化，多栈通用）— 澄清需求 → 多方案设计（≥3 套）→ 独立 critic 逐方案反驳 → 复盘沉淀 ADR',
  phases: [
    { title: 'Clarify', detail: '澄清需求范围（读 architect-memory）' },
    { title: 'Design', detail: '编写多方案设计（≥3 套可选）' },
    { title: 'DesignCritique', detail: '独立 critic 逐方案反驳（事实核查/成本/风险）' },
    { title: 'Retrospect', detail: '复盘沉淀选型 ADR' },
  ],
}

// ============================================================
// 方案设计 Workflow（对抗化版本，profile 驱动多栈通用）
// 触发条件：用户需要技术方案设计，但不需要完整 SDD 流程（无 Spec 阶段）
// 调用方式：Workflow({ name: 'design-doc', args: {requirement} })
//
// 对抗化设计：
//   1. 多方案 — 产出 ≥3 套可选方案（防单点拍板）
//   2. 对抗审查 — 独立 critic 逐方案反驳：成本/兼容性/风险/前提事实核查
//   3. 记忆闭环 — 起点读 architect-memory，终点复盘写回选型 ADR
// ============================================================

// ─── Profile 解析 ───
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
const memoryDir = P('memory_dir', 'docs/memory')
const docsDir = P('docs_dir', 'docs')
const specDir = P('spec_dir', 'docs/specs')
const flagsLine = (P('flags') || '')
const alignmentOn = /alignment_check\s*[:：=]\s*on/i.test(flagsLine)
const stackContext = isProfileMissing ? '' : ((profileRaw.match(/##\s*栈上下文([\s\S]*?)(?=\n##|$)/) || ['', ''])[1].trim().slice(0, 1500))

const requirement = typeof args === 'string' ? args : (args?.requirement || args?.description || JSON.stringify(args))

// 对抗审查回流上限
const MAX_REVISION = 2

phase('Clarify')
log(`开始方案设计 — 需求: ${requirement}（栈: ${stack}）`)

// 1. 澄清需求（起点读 architect-memory 形成记忆闭环）
const clarification = await agent(
  `作为架构师 agent，先读取 ${memoryDir}/architect-memory.md 了解架构决策上下文，再分析以下需求，如有模糊点先向用户澄清：

  需求: ${requirement}

  需要澄清的问题：
  1. 需求边界是什么？（做什么/不做什么）
  2. 有无性能或安全要求？
  3. ${alignmentOn ? '是否涉及对齐基线行为？对应基线哪个功能点？存疑先查 docs/ 记录，无记录上报，不得脑补。' : '有无与既有系统/契约的兼容性要求？'}
  4. 有无技术约束？（新依赖引入需用户确认）

  分析完成后，输出需求理解报告。如有模糊点，先向用户提问，不自行假设。`,
  { label: '澄清需求', phase: 'Clarify', model: 'sonnet' }
)

phase('Design')
log('需求澄清完成，编写多方案设计')

// 2. 多方案设计（≥3 套可区分方案）
let design = await agent(
  `基于以下需求理解，编写方案设计文档，输出到 ${docsDir}/ 目录（结构遵循 doc-writer skill 的 solution 模板）。

  需求理解: ${clarification}
  ${stackContext ? `\n栈上下文：\n${stackContext}\n` : ''}
  必须包含：
  1. 执行摘要（1句话）
  2. 现状分析
  3. **至少 3 套可选方案**，每套分析：改动范围、兼容性、成本、收益、潜在风险
  4. 详细设计（推荐方案：模块划分、接口设计、数据流）
  5. 阶段拆解（Phase 1/2/3，含预估工时和前置依赖）
  6. 风险评估（三类 🟢🟡🔴，精确到文件:行号）
  7. ROI 对比表（多方案横向对比）
  8. 不做清单
  9. 关键文件速查表

  约束：
  - 命名/术语决策前先 grep 全库统计各叫法出现次数，跟随多数派
  - 方案中引用的函数/方法/挂载点必须 grep 核实真实存在
  - 遵循项目架构分层与依赖方向${alignmentOn ? '；对齐基线行为的方案标注「对齐: <功能点>」，差异显式列出' : ''}`,
  { label: '编写多方案设计', phase: 'Design', model: 'sonnet' }
)

// 3. critic：独立逐方案反驳（对抗审查成对，可回流修订）
let designApproved = false
for (let round = 1; round <= MAX_REVISION && !designApproved; round++) {
  phase('DesignCritique')
  log(`方案对抗审查 — 第 ${round} 轮`)

  const designCritique = await agent(
    `作为独立 critic（与方案产出者不同上下文），使用 critic skill 的对抗审查纪律，逐方案反驳式审查 ${docsDir}/ 下刚产出的方案设计文档。

  对每套方案独立证伪：
  1. 前提事实核查 — 方案依赖的事实假设是否经 grep/源码核实？是否存在「凭错误前提拍板」的风险？
  2. 成本真实性 — 工时/改动范围估算是否低估？关键文件:行号是否真实存在？
  3. 兼容性 — 与现有架构分层/依赖方向是否冲突？有无未识别的耦合？
  4. 风险完备 — 三类风险是否遗漏（尤其并发/异步、数据迁移${alignmentOn ? '、基线行为差异' : ''}）？🟢🟡🔴 分级是否乐观？
  5. 方案完备性 — 是否真的给出了 ≥3 套可区分方案，还是同一方案的换皮？

  输出：
  - verdict: pass | fail
  - findings: 逐方案列出站不住的点（含 grep 核实的硬证据）
  - recommendation: 哪套方案最经得起反驳及理由
  - 若 fail，给出架构师必须修订的具体点`,
    { label: 'critic 逐方案反驳', phase: 'DesignCritique', model: 'sonnet' }
  )

  designApproved = !/verdict\s*[:：]\s*fail/i.test(designCritique)

  if (!designApproved) {
    if (round >= MAX_REVISION) {
      log('方案对抗审查达回流上限仍未通过，上报用户定夺')
      design += `\n\n[警告] 方案经 ${MAX_REVISION} 轮反驳仍有争议：\n${designCritique}`
      break
    }
    log(`方案审查未通过（第 ${round} 轮），架构师修订后重审`)
    design = await agent(
      `作为架构师 agent，根据以下 critic 反驳意见修订 ${docsDir}/ 下的方案设计文档：
      ${designCritique}

      只修订被指出的问题（补强事实核查/修正成本/补全风险），不扩大范围。`,
      { label: '架构师修订方案', phase: 'DesignCritique', model: 'sonnet' }
    )
  }
}
// 不得无条件报「通过」：达回流上限时是带警告交付，结论必须区分两种状态
log(designApproved ? '方案对抗审查通过' : '⚠️ 方案对抗审查未通过（达回流上限）— 已带警告交付，待用户定夺')

phase('Retrospect')
log('进入复盘沉淀阶段')

// 4. 复盘写回记忆（仅写高价值条目：选型决策 ADR、被反驳推翻的假设）
const retrospect = await agent(
  `作为架构师 agent，复盘本次方案设计流程，提炼可复用经验写回记忆。

  本次流程关键信息：
  - 需求: ${requirement}
  - 方案审查结论: ${designApproved ? '一次通过' : '经修订/有争议'}

  仅当本次出现以下高价值情况时才写入 ${memoryDir}/architect-memory.md，流水账不入：
  1. 最终选型决策（选了哪套方案、为什么）→ 「ADR」记录（四要素：时间/决策/原因/后果）
  2. 被 critic 反驳推翻的事实假设 → 「经验教训」
  3. 多方案对比中发现的通用权衡模式 → 「经验教训」

  写入遵循「为什么 + 决策上下文」；若后续功能进入实施，Spec/Design 落 ${specDir}/。`,
  { label: '复盘写回记忆', phase: 'Retrospect', model: 'sonnet' }
)

log('方案设计 workflow 完成')
return { stack, clarification, design, retrospect }
