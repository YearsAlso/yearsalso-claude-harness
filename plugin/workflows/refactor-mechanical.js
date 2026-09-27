export const meta = {
  name: 'refactor-mechanical',
  description: '机械性代码修改（多栈通用）— 明确的重构/重命名/提取/格式化，不需要方案设计，直接改代码',
  phases: [
    { title: 'Plan', detail: '确认修改范围和影响' },
    { title: 'Execute', detail: '执行机械性修改' },
    { title: 'Verify', detail: '验证修改完整性 + 门禁实跑' },
  ],
}

// ============================================================
// 机械性代码修改 Workflow
// 触发条件：用户要求明确的代码重构、重命名、提取公共逻辑、格式化
// 特点：不需要方案设计，不需要风险评估，直接操作
//       （范围大时可由 leader 降级为单 agent 直接执行 — 见 leader 裁决 B）
// 调用方式：Workflow({ name: 'refactor-mechanical', args: {task} })
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
const engineerAgent = P('engineer_agent', stack === 'go' ? 'go-backend-engineer' : stack === 'web' ? 'web-frontend-engineer' : '')
const buildCheck = P('build_check', stack === 'go' ? 'go build ./...' : 'pnpm build')
const lintCheck = P('lint_check', stack === 'go' ? 'go vet ./...' : 'pnpm lint')
const testCommand = P('test_command', stack === 'go' ? 'go test ./...' : 'pnpm test')
const implLead = engineerAgent ? `作为 ${engineerAgent} agent` : '作为实施工程师 agent（按仓库特征栈选择插件内对应工程师 agent 的职责纪律执行）'

const task = typeof args === 'string' ? args : (args?.task || args?.description || JSON.stringify(args))

phase('Plan')
log(`开始机械性修改 — 任务: ${task}（栈: ${stack}）`)

const plan = await agent(
  `分析以下机械性修改任务，制定修改计划：

  任务: ${task}

  输出计划：
  1. 修改范围（哪些文件、哪些符号 — 先 grep 枚举全部引用点）
  2. 修改类型（重命名/提取/移动/格式化/其他）
  3. 影响分析（是否会破坏引用；对外契约如路由路径/JSON tag 是否在范围内 — 在则停下上报）
  4. 执行步骤（按顺序列出）

  注意：机械性修改不需要方案文档，直接输出修改计划。`,
  { label: '制定修改计划', phase: 'Plan', model: 'sonnet' }
)

phase('Execute')
log('计划完成，执行修改')

const execute = await agent(
  `${implLead}，按照以下计划执行机械性修改：

  计划: ${plan}

  规则：
  1. 一次只改一个逻辑单元
  2. 每步完成后检查是否有遗漏引用（grep 旧名应为 0）
  3. 类型定义同步更新
  4. 不改变原有逻辑和功能
  5. 保持代码风格一致`,
  { label: '执行修改', phase: 'Execute', model: 'sonnet' }
)

phase('Verify')
log('修改完成，验证完整性')

const verify = await agent(
  `验证机械性修改的完整性。

  原任务: ${task}
  执行记录: ${execute}

  验证清单：
  - [ ] 所有引用已更新（grep 旧符号名无残留）
  - [ ] 类型定义已同步
  - [ ] 门禁实跑通过：\`${buildCheck}\` && \`${lintCheck}\` && \`${testCommand}\`（引用真实输出，不得凭走读判定）
  - [ ] 原有逻辑未改变
  - [ ] 代码风格一致

  输出验证报告，末尾给出 allChecksPassed: yes | no。`,
  { label: '验证修改', phase: 'Verify', model: 'sonnet' }
)

log('机械性修改 workflow 完成')
return { stack, plan, execute, verify }
