---
name: react-coding
description: React 组件编写 — 编写 .tsx 文件时触发。遵循项目 UI 原语库 + 封装风格（默认 Radix UI + shadcn/ui），使用 React 19 + TypeScript 模式。
---

# React Coding — React 组件编写 Skill

## 触发条件

编写或修改 `*.tsx` 组件、（components/hooks/pages 下的）`*.ts` 文件时。
技术栈细节以 profile「栈上下文」为准；下文默认 React 19 + Radix/shadcn 风格。

## 编写规范

1. **基础交互组件用 UI 原语** — Dialog/Select/Tabs/Tooltip 等不重复造轮子
2. **统一封装风格** — shadcn/ui 风格：forwardRef + `cn()` + CVA variants
3. **props 类型完整** — 每个 prop 有类型与注释；禁止 `any`，必要时类型守卫
4. **Hooks 规则** — 只在顶层调用；依赖数组完整；effect 必须返回清理函数
5. **状态就近原则** — 本地态 useState/useReducer；跨组件共享才提升或抽 hook
6. **三态齐全** — 数据视图必须处理 loading / error / empty，异常给友好提示

## 组件模板

```tsx
import { cn } from '<lib-utils-path>' // 以 profile 栈上下文为准

interface ComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 变体样式 */
  variant?: 'default' | 'primary'
}

function Component({ className, variant = 'default', ...props }: ComponentProps) {
  return (
    <div className={cn('base-classes', variant === 'primary' && 'primary-classes', className)} {...props}>
      {props.children}
    </div>
  )
}
```

## 数据获取模板

```tsx
const [data, setData] = useState<DataType | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  const ctrl = new AbortController()
  getData({ signal: ctrl.signal })
    .then(setData)
    .catch(e => { if (!ctrl.signal.aborted) setError(e.message) })
    .finally(() => setLoading(false))
  return () => ctrl.abort()
}, [])

if (loading) return <LoadingSkeleton />
if (error) return <ErrorState message={error} />
if (!data) return <EmptyState />
return <DataView data={data} />
```

## 性能纪律

- 默认不 premature 优化；出现以下信号才用 useMemo/useCallback：昂贵计算被重复执行、引用不稳定导致子组件/effect 连锁重渲染
- 长列表虚拟化；高频事件（scroll/resize/输入）节流
- memo 用于纯展示组件且父组件渲染频繁的场景
