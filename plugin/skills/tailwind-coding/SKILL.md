---
name: tailwind-coding
description: Tailwind 样式编写 — 编写 className/CSS 时触发。使用主题令牌（@theme / CSS 自定义属性），禁止硬编码颜色间距。
---

# Tailwind Coding — 样式编写 Skill

## 触发条件

编写/修改 Tailwind 类名、主题 CSS、组件样式时。

## 核心规则

1. **令牌优先** — 颜色/间距/阴影/圆角用主题令牌（`bg-primary`、`var(--color-*)`、`--radius-*`），禁止硬编码 hex/px
2. **类名合并用 cn()** — `cn('base', cond && 'cond', className)`，不手拼字符串
3. **variants 收敛重复样式** — 多形态组件用 CVA（class-variance-authority）定义 variant/size，不在 JSX 里堆三元
4. **响应式移动优先** — 默认样式为移动端，`md:` `lg:` 向上覆盖
5. **dark 模式** — 用令牌自动切换，禁止 `dark:` 里再硬编码颜色
6. **不滥用 !important 与任意值** — `text-[13px]` 这类任意值是坏味道，先扩展令牌

## 检查清单（交付前）

- [ ] 无裸 hex 颜色（grep `#[0-9a-f]{6}` 新 diff 应为 0）
- [ ] 间距全部来自刻度（4 的倍数体系）
- [ ] 交互态齐全：hover / focus-visible / active / disabled
- [ ] 空态/加载态/错误态样式与文案存在
- [ ] 长文本溢出处理（truncate / break-words / min-w-0）
