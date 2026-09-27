---
name: vitest-testing
description: Vitest 单元/组件测试 — 测试编写模式、mock 纪律、testing-library 交互测试、必须实跑真实结果。前端编写/验证测试时使用。
---

# Vitest Testing Skill

## 使用时机

1. 为前端功能编写单元/组件测试
2. Bug 修复前补复现用例（红→绿）
3. 执行测试并判定结果

## 硬性纪律

1. **必须实跑** — 实际执行 `pnpm test`（profile gate_commands.test_command），引用真实输出
2. **红→绿** — Bug 修复先写复现失败的用例，再修复使其通过
3. **禁跳过** — 不用 `it.skip` / `expect(true).toBe(true)` 假通过

## 编写模式

### 纯逻辑单测

```ts
import { describe, it, expect } from 'vitest'

describe('formatVersion', () => {
  it.each([
    ['完整版本', '1.2.3', 'v1.2.3'],
    ['缺 patch', '1.2', 'v1.2.0'],
    ['空输入', '', ''],
  ])('%s', (_name, input, want) => {
    expect(formatVersion(input)).toBe(want)
  })
})
```

### 组件测试（testing-library）

- 按**用户视角**查询（getByRole/getByLabelText），不测实现细节类名
- 交互用 `userEvent`（非 fireEvent），模拟真实输入序列
- 断言可见结果（文本/状态/可访问性属性），不断言快照大对象

### Mock 纪律

1. 只 mock **外部边界**（网络、定时器、浏览器 API）；内部模块不 mock
2. HTTP 用 `vi.stubGlobal('fetch', ...)` 或 msw；时间用 `vi.useFakeTimers()` 并显式 advance
3. 每个 mock 在用例内显式断言被调次数/参数（`toHaveBeenCalledTimes`）

## 覆盖检查

- 新增公共函数/组件必须有对应用例（无则补上后重跑）
- 边界：空值 / 超长输入 / 并发点击 / 请求失败路径
- 交互态：loading → success / error 两条路径都有断言
