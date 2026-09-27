export const meta = {
  name: 'design-eval',
  description: '方案评估（多栈通用）— 评估已有方案/技术选型/架构决策，产出评估报告与风险登记册',
  phases: [
    { title: 'Analyze', detail: '分析方案内容' },
    { title: 'Evaluate', detail: '多维度评估' },
    { title: 'Report', detail: '产出评估报告' },
  ],
}

// ============================================================
// 方案评估 Workflow
// 触发条件：用户需要评估已有方案、技术选型、架构决策的可行性
// 调用方式：Workflow({ name: 'design-eval', args: {subject} })
// 与 design-doc 的区别：design-doc 是从零产出多套方案；design-eval 是对
// 已有方案/外部提案做单点评估（成本/风险/ROI）。
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

const subject = typeof args === 'string' ? args : (args?.subject || args?.description || JSON.stringify(args))

phase('Analyze')
log(`开始方案评估 — ${subject}（栈: ${stack}）`)

const analysis = await agent(
  `作为架构师 agent，先读取 ${memoryDir}/architect-memory.md 了解既有决策上下文（避免评估结论与在效 ADR 冲突），再分析以下方案：
  ${subject}

  分析维度：
  1. 方案目标和范围
  2. 技术可行性（引用的函数/文件 grep 核实存在）
  3. 与现有架构的兼容性
  4. 关键依赖和前置条件

  输出：方案理解分析报告`,
  { label: '方案分析', phase: 'Analyze', model: 'sonnet' }
)

phase('Evaluate')
log('分析完成，进入多维度评估')

const evaluation = await agent(
  `基于以下分析结果进行多维度评估：
  ${analysis}

  评估维度：
  1. 实现成本（人天估算）
  2. 维护成本（低/中/高）
  3. 风险级别（🟢可控/🟡弱可控/🔴不可控），精确到文件:行号
  4. 性能影响
  5. 安全影响
  6. 可扩展性
  7. 替代方案对比（如有）

  输出：评估表 + 风险登记册`,
  { label: '多维度评估', phase: 'Evaluate', model: 'sonnet' }
)

phase('Report')
log('评估完成，产出评估报告')

const report = await agent(
  `基于分析和评估结果，按 doc-writer skill 的 solution 结构编写方案评估报告，输出到 ${docsDir}/。

  分析: ${analysis}
  评估: ${evaluation}

  必须包含：
  1. 执行摘要
  2. 现状分析
  3. 方案评估详情
  4. 风险评估（三类 🟢🟡🔴）
  5. ROI 评分
  6. 推荐意见（采纳/修订后采纳/否决 + 理由）

  若评估产生新的取舍决策，复盘要点写入 ${memoryDir}/architect-memory.md（ADR 四要素，仅高价值条目）。`,
  { label: '产出评估报告', phase: 'Report', model: 'sonnet' }
)

log('方案评估 workflow 完成')
return { stack, analysis, evaluation, report }
