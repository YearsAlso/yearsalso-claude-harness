// dev-harness 干跑验证器 — 不依赖 LLM，用真实仓库的 .claude/project-profile.md
// 驱动 workflow 源码，确定性验证三件事：
//   1. profile 解析（P() 正则对真实文件的解析结果）
//   2. 按栈切换工程师 agent（implLead / label 动态注入）
//   3. fail-closed 独立门禁（exitCode=0 放行 / =1 中止 / 解析不出 中止）
// 用法：node verify/dry-run.mjs
// 模式：源仓库存在 → 用真实 .claude/project-profile.md；不存在（如 CI）→ 回退 verify/fixtures/ 夹具
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const REPOS = {
  go: {
    name: 'daqsvrv5',
    repo: process.env.HV_GO_REPO || path.join(os.homedir(), 'Projects/Company/TDM/daqsvrv5'),
    fixture: 'verify/fixtures/profile-go.md',
    expect: {
      stack: 'go',
      engineer: 'go-backend-engineer',
      gateCommand: 'scripts/check.sh',
      reviewSkill: 'go-code-review',
      specDir: 'docs/specs',
      memoryDir: 'docs/memory',
      raceClause: 'go test -race',
      alignment: true,
    },
  },
  web: {
    name: 'tdmversionmanager',
    repo: process.env.HV_WEB_REPO || path.join(os.homedir(), 'Projects/Company/TDM/tdmversionmanager'),
    fixture: 'verify/fixtures/profile-web.md',
    expect: {
      stack: 'multi',
      engineer: 'web-frontend-engineer',
      gateCommand: 'pnpm ci:check',
      reviewSkill: 'frontend-code-review',
      specDir: 'specs/active',
      memoryDir: 'docs/memory',
      raceClause: null, // race_command 为空 → 不应注入 race 条款
      alignment: true,
    },
  },
}

const GATE_SCENARIOS = {
  pass: '门禁验证（stub）\n- exitCode: 0\n- testSummary: ok',
  fail: '门禁验证（stub）\n- exitCode: 1\n- testSummary: FAIL: TestX\n失败用例清单（stub）',
  unparseable: '我检查了一下，构建和测试看起来都没问题，应该可以放行。（stub：未给出 exitCode）',
}

// 额外场景：覆盖实跑抓出的四类假阳性
const EXTRA_SCENARIOS = {
  'implement-empty': { overrides: { codeFiles: 'codeChangedFiles: 0' }, wf: ['feature-dev.js', 'bug-fix.js'] },
  'critic-stuck': { overrides: { critic: 'fail' }, wf: ['feature-dev.js', 'bug-fix.js'] },
  'p0-stuck': { overrides: { p0: 'yes' }, wf: ['feature-dev.js', 'bug-fix.js'] },
}

let failures = 0
function assert(cond, msg) {
  console.log(`  ${cond ? '✅' : '❌'} ${msg}`)
  if (!cond) failures++
}

// ─── workflow 运行时 stub ───
function makeRuntime(profilePath, gateReply, overrides = {}) {
  const calls = []
  const phases = []
  const logs = []
  const agent = async (prompt, opts = {}) => {
    calls.push({ prompt: String(prompt), opts })
    if (/project-profile\.md/.test(prompt) && /原文完整返回/.test(prompt)) {
      if (!fs.existsSync(profilePath)) return 'MISSING'
      return fs.readFileSync(profilePath, 'utf8')
    }
    if (/产物检查/.test(prompt) || /codeChangedFiles/.test(prompt)) return overrides.codeFiles || 'codeChangedFiles: 3'
    if (/作为测试门禁验证器/.test(prompt)) return gateReply
    if (/作为 tester agent/.test(prompt)) return '测试报告（stub）\n- allTestsPassed: yes'
    if (/作为独立 critic/.test(prompt)) return overrides.critic === 'fail'
      ? 'critic（stub）\n- verdict: fail\n- findings: 持续不通过'
      : 'critic（stub）\n- verdict: pass'
    if (/作为 reviewer agent/.test(prompt)) return overrides.p0 === 'yes'
      ? '审查（stub）\n- hasP0: yes\n- 总体评价: 阻塞'
      : '审查（stub）\n- hasP0: no\n- 总体评价: 安全'
    if (/作为 auto-committer/.test(prompt)) return '已按规范提交（stub）'
    if (/复盘/.test(prompt)) return '复盘完成，沉淀 0 条高价值记忆（stub）'
    return 'OK（stub）'
  }
  const parallel = async (fns) =>
    Promise.all((fns || []).map((f) => (typeof f === 'function' ? f() : f)))
  const pipeline = async (items, ...stages) => {
    const arr = typeof items === 'function' ? [await items()] : items || []
    const out = []
    for (const it of arr) {
      let acc = it
      for (const st of stages) acc = await st(acc, it)
      out.push(acc)
    }
    return out
  }
  const phase = (t) => phases.push(t)
  const log = (m) => logs.push(String(m))
  return { calls, phases, logs, api: { agent, parallel, pipeline, phase, log } }
}

async function runWorkflow(file, args, rt) {
  const src = fs.readFileSync(path.join(ROOT, 'plugin/workflows', file), 'utf8')
    .replace(/^export\s+const/gm, 'const')
  const fn = new Function(
    'args', 'agent', 'parallel', 'pipeline', 'phase', 'log',
    `return (async () => {\n${src}\n})()`
  )
  return fn(args, rt.api.agent, rt.api.parallel, rt.api.pipeline, rt.api.phase, rt.api.log)
}

const find = (rt, re) => rt.calls.find((c) => re.test(c.prompt))

// ─── feature-dev 断言 ───
function checkFeatureDev(rt, e, gateScenario, result) {
  const impl = find(rt, /Design 文档实施/)
  assert(!!impl, '存在工程师实施调用')
  assert(impl?.prompt.startsWith(`作为 ${e.engineer} agent`), `implLead 注入按栈工程师 → ${e.engineer}`)
  assert(impl?.opts.agentType === `dev-harness:${e.engineer}`, `agentType 硬绑定插件 agent → dev-harness:${e.engineer}`)
  assert(rt.calls.some((c) => /产物检查/.test(String(c.opts.label || '') + c.prompt)), '存在实施产物存在性断言调用')
  assert(impl?.opts.label === `${e.engineer}实施`, `实施 label 动态化 → "${e.engineer}实施"`)
  assert(impl?.prompt.includes(`${e.memoryDir}/${e.engineer}-memory.md`), '记忆闭环读取路径按 profile（memory_dir + engineer_agent）拼接')
  assert(impl?.prompt.includes(e.gateCommand.split('&&')[0].trim().slice(0, 20)) || find(rt, /作为测试门禁验证器/)?.prompt.includes(e.gateCommand), 'gate 命令来自 profile（实施或门禁调用可见）')
  const gate = find(rt, /作为测试门禁验证器/)
  assert(gate?.prompt.includes(e.gateCommand), `门禁 prompt 含 profile.gate_command「${e.gateCommand}」`)
  const spec = find(rt, /作为 PM agent/)
  assert(spec?.prompt.includes(e.specDir), `Spec 输出目录按 profile.spec_dir「${e.specDir}」`)
  const review = find(rt, /作为 reviewer agent/)
  assert(review?.prompt.includes(e.reviewSkill), `审查维度按 profile.review_skill「${e.reviewSkill}」`)
  const alignHit = rt.calls.some((c) => /行为对齐（alignment_check=on）|基线行为先查/.test(c.prompt))
  assert(alignHit === !!e.alignment, `alignment flag → ${e.alignment ? '对齐条款已注入' : '对齐条款未注入'}`)
  const raceHit = e.raceClause ? rt.calls.some((c) => c.prompt.includes(e.raceClause)) : !rt.calls.some((c) => /追加 `go test -race|额外执行 `go test -race/.test(c.prompt))
  assert(raceHit, e.raceClause ? `race 条款注入（${e.raceClause}…）` : 'race_command 为空 → 未注入 Go race 条款')

  const committed = rt.calls.some((c) => /作为 auto-committer/.test(c.prompt))
  const reachedCommitPhase = rt.phases.includes('Commit')
  if (gateScenario === 'pass') {
    assert(committed && reachedCommitPhase, '门禁 exitCode=0 → 放行进入 Commit')
  } else {
    assert(!committed && !reachedCommitPhase, `门禁 ${gateScenario === 'fail' ? 'exitCode=1' : '解析不出退出码'} → fail-closed 中止（未进入 Commit）`)
    assert(result && result.commit === undefined, '返回值无 commit 字段（确实在门禁处 return）')
    const abortLog = rt.logs.some((l) => /中止 workflow/.test(l))
    assert(abortLog, '日志给出中止原因')
  }
}

// ─── bug-fix 断言（重点：同一 profile 驱动下 agent 切换 + 门禁）───
function checkBugFix(rt, e, gateScenario, result) {
  const impl = find(rt, /分析以下 Bug 的根因/)
  assert(impl?.prompt.startsWith(`作为 ${e.engineer} agent`), `bug-fix 根因分析 agent 按栈 → ${e.engineer}`)
  const fix = find(rt, /实施修复|根因分析实施修复/)
  assert(fix?.opts.agentType === `dev-harness:${e.engineer}`, `bug-fix 修复调用 agentType 硬绑定 → dev-harness:${e.engineer}`)
  assert(rt.calls.some((c) => /产物检查/.test(String(c.opts.label || '') + c.prompt)), '存在修复产物存在性断言调用')
  const gate = find(rt, /作为测试门禁验证器|门禁验证器/)
  assert(gate?.prompt.includes(e.gateCommand), `bug-fix 门禁 prompt 含 gate_command「${e.gateCommand}」`)
  const committed = rt.calls.some((c) => /作为 auto-committer/.test(c.prompt))
  if (gateScenario === 'pass') {
    assert(committed, 'bug-fix：门禁 0 → 放行提交')
  } else {
    assert(!committed, 'bug-fix：门禁非 0/不可解析 → 未提交（fail-closed）')
    assert(result === undefined || result.commit === undefined, 'bug-fix：返回不含 commit')
  }
}

// ─── 实跑抓出的假阳性场景断言 ───
function checkExtra(scenario, wfFile, rt, e, result) {
  const isFD = wfFile === 'feature-dev.js'
  const gate = find(rt, /作为测试门禁验证器/)
  const committed = rt.calls.some((c) => /作为 auto-committer/.test(c.prompt))
  if (scenario === 'implement-empty') {
    assert(result?.aborted === (isFD ? 'ImplementEmpty' : 'FixEmpty'), `空实施 → fail-closed 中止（aborted=${result?.aborted}）`)
    assert(!gate && !committed, '空实施 → 未跑门禁/未提交（堵住 exit0 假阳性）')
  } else if (scenario === 'critic-stuck') {
    assert(result?.aborted === (isFD ? 'SpecCritique' : 'RootCauseCritique'), `critic 持续 fail 达上限 → 中止上报（aborted=${result?.aborted}）`)
    assert(!rt.phases.includes(isFD ? 'Design' : 'Fix'), '未进入下游阶段（不带警告继续）')
    assert(!rt.logs.some((l) => /审查通过|证伪通过/.test(l)), '日志不再假报「通过」')
  } else if (scenario === 'p0-stuck') {
    assert(result?.aborted === 'Review', `P0 持续存在达上限 → 中止（aborted=${result?.aborted}）`)
    assert(!gate && !committed, 'P0 未消除 → 未跑门禁/未提交')
  }
}

// ─── 主流程 ───
for (const [stackKey, r] of Object.entries(REPOS)) {
  const realPath = path.join(r.repo, '.claude/project-profile.md')
  const useFixture = !fs.existsSync(realPath)
  const profilePath = useFixture ? path.join(ROOT, r.fixture) : realPath
  console.log(`\n════ ${r.name}（${stackKey}）profile: ${profilePath}${useFixture ? ' 【夹具模式：源仓库不可达，CI 环境】' : ' 【真实仓库】'}`)
  assert(fs.existsSync(profilePath), 'project-profile.md（真实或夹具）存在')

  // 契约字段用 workflow 同款正则复析一遍（证明解析器与真实文件兼容）
  const raw = fs.readFileSync(profilePath, 'utf8')
  const P = (k, fb = '') => {
    const m = raw.match(new RegExp('^' + k + '\\s*[:：]\\s*(.+)$', 'im'))
    return m ? m[1].replace(/#.*$/, '').trim() : fb
  }
  console.log('── 契约解析（P() 同款正则）──')
  assert(P('stack') === r.expect.stack, `stack = ${P('stack')}`)
  assert(P('engineer_agent') === r.expect.engineer, `engineer_agent = ${P('engineer_agent')}`)
  assert(P('gate_command') === r.expect.gateCommand, `gate_command = ${P('gate_command')}`)
  assert(P('review_skill') === r.expect.reviewSkill, `review_skill = ${P('review_skill')}`)
  assert(P('spec_dir') === r.expect.specDir, `spec_dir = ${P('spec_dir')}`)
  assert(/alignment_check\s*[:：=]\s*on/i.test(P('flags')) === r.expect.alignment, `flags.alignment_check = ${r.expect.alignment}`)
  assert(r.expect.raceClause ? P('race_command').includes(r.expect.raceClause) : !P('race_command'), `race_command = "${P('race_command') || '(空，注释被正确剥离)'}"`)

  for (const wf of [
    { file: 'feature-dev.js', args: { requirement: '干跑验证：假需求 X' }, check: checkFeatureDev },
    { file: 'bug-fix.js', args: { bug: '干跑验证：假缺陷 Y' }, check: checkBugFix },
  ]) {
    for (const [scenario, reply] of Object.entries(GATE_SCENARIOS)) {
      console.log(`── ${wf.file} / 门禁场景: ${scenario} ──`)
      const rt = makeRuntime(profilePath, reply)
      let result
      try {
        result = await runWorkflow(wf.file, wf.args, rt)
      } catch (err) {
        assert(false, `workflow 执行抛错: ${err.message}`)
        continue
      }
      rt.check?.length // noop
      wf.check(rt, r.expect, scenario, result)
    }
    for (const [scenario, cfg] of Object.entries(EXTRA_SCENARIOS)) {
      if (!cfg.wf.includes(wf.file)) continue
      console.log(`── ${wf.file} / 假阳性场景: ${scenario} ──`)
      const rt = makeRuntime(profilePath, GATE_SCENARIOS.pass, cfg.overrides)
      let result
      try {
        result = await runWorkflow(wf.file, wf.args, rt)
      } catch (err) {
        assert(false, `workflow 执行抛错: ${err.message}`)
        continue
      }
      checkExtra(scenario, wf.file, rt, r.expect, result)
    }
  }
}

console.log(`\n════ 结果：${failures === 0 ? '全部断言通过 ✅' : `${failures} 条断言失败 ❌`} ════`)
process.exit(failures === 0 ? 0 : 1)
