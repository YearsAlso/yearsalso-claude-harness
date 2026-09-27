export const meta = {
  name: 'doc-tidy',
  description: '文档整理（多栈通用）— 整理文档、更新记忆、归档已完成的 Spec/Design、记忆剪枝（superseded-by 标注）',
  phases: [
    { title: 'Scan', detail: '扫描文档和记忆状态（含记忆剪枝检查）' },
    { title: 'Tidy', detail: '整理和归档' },
    { title: 'Update', detail: '更新记忆' },
  ],
}

// ============================================================
// 文档整理 Workflow（profile 驱动目录）
// 触发条件：用户要求整理文档、更新记忆、归档已完成工作
// 调用方式：Workflow({ name: 'doc-tidy', args: {scope} })
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
const memoryDir = P('memory_dir', 'docs/memory')
const specDir = P('spec_dir', 'docs/specs')
const archiveDir = P('archive_dir', specDir + '/archive')
const docsDir = P('docs_dir', 'docs')

const scope = typeof args === 'string' ? args : (args?.scope || '全面整理')

phase('Scan')
log(`开始文档整理 — 范围: ${scope}`)

const scan = await agent(
  `扫描以下内容并报告状态：

  1. ${memoryDir}/ 下的记忆文件 → 是否过期？是否需要更新？
     重点做记忆剪枝检查：
     - ADR 被后续 ADR 反转/取代但未标注 superseded-by（逐条对比后续 ADR 是否撤销了早期决策）
     - 内容重叠的条目（同一主题多处记录，需合并或互相引用）
     - 已过时/被实现推翻的教训条目
     - 新增 ADR 未同步 critic 必检项标记（「已纳入 critic」或「豁免」，对照 ${memoryDir}/critic-checklist.md）
  2. ${specDir}/ 下的 Spec/Design 文档 → 对应功能是否已完成？已完成的移入 ${archiveDir}/
  3. ${docsDir}/ 下的其他文档 → 是否有与代码现状脱节的文档（如模块名已变更但文档未更新）？

  输出：扫描报告，列出需要整理的内容`,
  { label: '扫描文档状态', phase: 'Scan', model: 'sonnet' }
)

phase('Tidy')
log('扫描完成，执行整理')

const tidy = await agent(
  `基于以下扫描结果执行整理：
  ${scan}

  整理操作：
  1. 已完成功能的 Spec+Design → 成对移入 ${archiveDir}/（保留原文）
  2. 过期记忆 → 标注过期或更新
  3. 记忆剪枝（${memoryDir}/，只标注不删除原文）：
     - 被取代的 ADR → 条目内补「superseded-by: ADR-XXX — 被取代范围/仍有效部分」标注
     - 重叠条目 → 保留信息量更大的一条，另一条改为指向引用
     - 历史 ADR 未标 critic 状态 → 补「已纳入 critic」或「豁免（理由）」标记
  4. 与代码脱节的文档 → 更新为与代码一致（以代码为准）
  5. 文档引用一致性 → 检查交叉引用是否有效

  执行前先确认再操作。`,
  { label: '执行整理归档', phase: 'Tidy', model: 'sonnet' }
)

phase('Update')
log('整理完成，更新记忆')

const update = await agent(
  `更新记忆文件，记录本次文档整理操作。

  写入 ${memoryDir}/pm-memory.md：
  - 文档整理日期和范围
  - 归档的文档列表

  写入 ${memoryDir}/architect-memory.md：
  - 归档的 Spec/Design 记录
  - 记忆剪枝操作记录（哪些 ADR 补了 superseded-by / critic 标记）`,
  { label: '更新记忆', phase: 'Update', model: 'sonnet' }
)

log('文档整理 workflow 完成')
return { scan, tidy, update }
