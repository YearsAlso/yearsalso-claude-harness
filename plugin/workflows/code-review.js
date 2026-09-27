export const meta = {
  name: 'code-review',
  description: '代码审查（增强，多栈通用）— 并行多维度审查 → 汇总去重 → critic 证伪去误报 → P0 分级 → 沉淀问题模式与误报黑名单',
  phases: [
    { title: 'ParallelReview', detail: '并行多维度审查（读误报黑名单）' },
    { title: 'Dedup', detail: '汇总去重' },
    { title: 'AdversarialFilter', detail: '独立 critic 证伪去误报' },
    { title: 'Report', detail: '分级汇总报告' },
    { title: 'Persist', detail: '沉淀 reviewer-memory' },
  ],
}

// ============================================================
// 代码审查 Workflow（增强版，profile 驱动多栈通用）
// 触发条件：leader 路由 / 用户要求审查代码
// 调用方式：Workflow({ name: 'code-review' })
//
// 增强设计：
//   1. 并行维度扇出 — 各维度独立 agent 聚焦审查，比单 agent 全包更细
//   2. 对抗去误报 — 独立 critic 逐条证伪（Read/Grep 核实），剔除幻觉/误报
//   3. 记忆沉淀 — 重复问题模式 + 误报黑名单写 reviewer-memory，越用越准
//
// 审查维度按 profile.stack 选择；alignment_check=on 追加行为对齐维度；
// 项目专属维度从 docs/memory/critic-checklist.md（若存在）由维度内引用。
// parallel 扇出是 barrier：等全部维度完成才汇总。critic 与审查者不同上下文。
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
const reviewSkill = P('review_skill', stack === 'go' ? 'go-code-review' : stack === 'web' ? 'frontend-code-review' : '')
const flagsLine = (P('flags') || '')
const alignmentOn = /alignment_check\s*[:：=]\s*on/i.test(flagsLine)

// 按栈选择审查维度
const DIMS_BY_STACK = {
  go: [
    { key: 'correctness', label: '正确性与边界', desc: 'error 丢弃、空切片/nil map、类型断言、编解码字节序与长度校验、除零/溢出（P0）' },
    { key: 'concurrency', label: '并发安全', desc: '共享状态无锁、goroutine 无 recover、channel 泄漏/死锁、事件 handler 阻塞（P0）' },
    { key: 'resource-error', label: '资源与错误处理', desc: 'defer Close 缺失/循环内 defer、exec 无超时、事务 Rollback 兜底、context 传递（P0/P1）' },
    { key: 'maintainability', label: '可维护性', desc: '命名规范、魔法数字、超长函数、调试打印残留、绕过数据层（P1/P2）' },
  ],
  web: [
    { key: 'correctness', label: '组件正确性', desc: 'Hooks 规则、状态更新、事件处理、key 稳定性（P0）' },
    { key: 'types', label: '类型安全', desc: '新代码 any/@ts-ignore、props 类型不完整、可空未收窄、类型定义漂移（P0/P1）' },
    { key: 'ux-error', label: '用户体验与错误处理', desc: 'loading/error/empty 三态、失败反馈、重复提交、溢出与可访问性（P1）' },
    { key: 'maintainability', label: '样式与结构', desc: '主题令牌硬编码、上帝文件、handler/页面未按功能场景分组、渲染性能坏味道（P1/P2）' },
  ],
}
const GENERIC_DIMS = [
  { key: 'security', label: '安全性', desc: '硬编码密钥、注入（SQL/命令/XSS）、鉴权缺失/越权、外部输入未校验、路径穿越（P0）' },
]
const STACK_DIMS = DIMS_BY_STACK[stack] || [
  { key: 'correctness', label: '正确性与边界', desc: '错误处理缺失、边界条件、非法状态（P0）' },
  { key: 'resource', label: '资源与健壮性', desc: '资源泄漏、无超时/退出路径、异步竞态（P0/P1）' },
  { key: 'maintainability', label: '可维护性', desc: '命名、魔法值、超长函数、绕过分层约定（P1/P2）' },
]
const DIMENSIONS = [
  ...STACK_DIMS,
  ...GENERIC_DIMS,
  ...(alignmentOn
    ? [{ key: 'alignment', label: '基线行为对齐', desc: '与已记录基线行为是否一致、差异是否显式标注（P1）' }]
    : []),
]

phase('ParallelReview')
log(`开始并行 ${DIMENSIONS.length} 维度代码审查（栈: ${stack}${isProfileMissing ? '，⚠️ profile 缺失用通用维度' : ''}）`)

// 1. 并行维度审查（各 agent 独立聚焦；先读误报黑名单避免重复报已知约定）
const dimFindings = await parallel(
  DIMENSIONS.map((d) => () =>
    agent(
      `作为 reviewer agent，先按 ${reviewSkill || '对应栈 code-review'} skill 掌握本维度检查表，再读取 ${memoryDir}/reviewer-memory.md 的「误报黑名单」（若存在），然后针对当前 git diff 仅审查「${d.label}」这一个维度。

  维度说明：${d.desc}

  要求：
  - 只报本维度的问题，不报其他维度
  - 每个问题标注文件:行号（基于当前文件，非 diff）
  - 每条发现必须 Read/Grep 核实该行代码真实如此，禁止凭印象
  - 本项目既有约定/无影响写法不算问题
  ${isProfileMissing ? '' : `- 项目专属必检项对照 ${memoryDir}/critic-checklist.md（若存在）中属于本维度的条目`}

  输出：| 严重度(P0/P1/P2) | 文件:行号 | 问题 | 建议 | 的表格；无发现则明确说「本维度无发现」。`,
      { label: `审查-${d.label}`, phase: 'ParallelReview', model: 'sonnet' }
    )
  )
)

const combined = dimFindings.map((r, i) => `### ${DIMENSIONS[i].label}\n${r}`).join('\n\n')

phase('Dedup')
log('进入汇总去重')

// 2. 汇总去重（跨维度可能报同一条目）
const deduped = await agent(
  `汇总以下 ${DIMENSIONS.length} 个维度的审查发现，去重并按严重度排序：

  ${combined}

  要求：
  1. 跨维度重复的同一条目合并为一条（保留最高严重度）
  2. 按 P0 → P1 → P2 排序
  3. 输出统一表格：| 严重度 | 文件:行号 | 维度 | 问题 |
  4. 末尾统计 P0/P1/P2 各计数`,
  { label: '汇总去重', phase: 'Dedup', model: 'sonnet' }
)

phase('AdversarialFilter')
log('进入对抗去误报')

// 3. 独立 critic 证伪去误报（与审查者不同上下文；逐条核实是否真实）
const filtered = await agent(
  `作为独立 critic（与上述审查者不同上下文），使用 critic skill 的对抗审查纪律，逐条证伪以下审查发现，剔除误报与幻觉：

  ${deduped}

  对每一条发现：
  1. 用 Read/Grep 核实「文件:行号」是否真实存在该代码
  2. 判断是否为真问题，还是误报（如：本项目的既有约定、实际无影响的写法、审查者幻觉）
  3. 参考 ${memoryDir}/reviewer-memory.md 的误报黑名单（若存在）

  输出：
  - confirmed: 确认的真实问题（保留原表格行）
  - rejected: 剔除的误报 + 剔除理由（供沉淀黑名单）
  - hasP0: yes | no（基于 confirmed）`,
  { label: 'critic 去误报', phase: 'AdversarialFilter', model: 'sonnet' }
)

const hasP0 = /hasP0\s*[:：]\s*yes/i.test(filtered)

phase('Report')
log('去误报完成，生成分级报告')

// 4. 分级汇总报告（含 P0 阻塞判定）
const report = await agent(
  `基于以下经过去误报的审查结果生成最终报告：
  ${filtered}

  报告格式：
  1. P0 必须修复（阻塞合并）
  2. P1 建议修复
  3. P2 可优化
  4. 总体评价：安全 | 需修改 | 阻塞
  5. 修复建议优先级

  ${hasP0 ? '⚠️ 检测到 P0，总体评价应为「阻塞」，并明确提示需先修复 P0。' : '无 P0，按实际情况评价。'}`,
  { label: '分级汇总报告', phase: 'Report', model: 'sonnet' }
)

phase('Persist')
log('进入记忆沉淀')

// 5. 沉淀 reviewer-memory（重复问题模式 + 误报黑名单；仅写高价值条目）
const persist = await agent(
  `作为 reviewer agent，将本次审查的可复用结论沉淀到 ${memoryDir}/reviewer-memory.md（不存在则创建）。

  本次材料：
  - 确认的真实问题: ${filtered}

  仅写两类高价值条目，流水账/一次性问题不入：
  1. 重复性问题模式 — 本项目反复出现的缺陷（如并发 map 读写、defer 循环、error 丢弃、Hooks 依赖数组缺漏）→「问题模式」，附文件:行号示例，供后续审查重点盯防
  2. 误报黑名单 — 本次被 critic 剔除、且属于本项目既有约定的条目 →「误报黑名单」，供后续审查直接跳过

  已存在的条目做合并更新，不重复记录。写入遵循「为什么 + 上下文」。`,
  { label: '沉淀 reviewer-memory', phase: 'Persist', model: 'sonnet' }
)

log('代码审查 workflow 完成')
return { stack, dimensions: DIMENSIONS.map(d => d.label), deduped, filtered, report, hasP0, persist }
