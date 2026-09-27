---
name: ts-check
description: TypeScript 类型校验 — 实施后/提交前运行类型检查并正确处理报错；strict 模式适配、类型漂移排查。TS/TSX 变更完成时使用。
---

# TS Check — TypeScript 类型校验 Skill

## 使用时机

1. 前端实施完成后的自检（验证闭环的一环）
2. 修复类型报错、评估是否放宽类型约束时

## 执行流程

```bash
pnpm exec tsc --noEmit      # 或项目等价命令（以 profile gate_commands.lint_check 为准）
pnpm exec biome check .     # 或 eslint（以 profile 为准）
```

## 报错处理纪律

1. **禁止用 `any` / `@ts-ignore` 消错** — 这是掩盖问题不是修复；确有必要用 `@ts-expect-error` + 行内理由注释
2. **定位根因** — 类型报错多因上游定义漂移（API 契约变更、re-export 丢失），修定义点而不是调用点强转
3. **可空收窄** — 优先判空/默认值收窄，非空断言 `!` 只在不变式可证明时使用并注释
4. **泛型保守** — 拿不准时先具体类型，不为了"通用"提前上多层泛型
5. **新代码 strict** — 存量宽松配置不作为新代码理由；新文件自带完整类型

## 常见类型陷阱

- 事件处理器 `React.MouseEvent` vs `Event` 混用
- `useEffect` 异步回调里的 state 闭包过期（函数式更新解决）
- API 层 `unknown` 直当 `T` — 必须经校验/断言函数收窄
- barrel export（index.ts）循环引用导致类型变 `any` 静默扩散
