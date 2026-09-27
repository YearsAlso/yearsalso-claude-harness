---
name: frontend-code-review
description: 前端代码审查维度清单 — 组件正确性/Hooks 规则/类型安全/性能/样式令牌/错误处理逐维度检查。reviewer 与前端工程师自检时使用。
---

# Frontend Code Review Skill

## 审查维度清单（每条发现 Read/Grep 核实后标注 文件:行号）

### 1. 组件正确性（P0）

- Hooks 规则违反：条件/循环内调用 hook、依赖数组缺漏或对象依赖每帧新建
- 状态更新错误：直接 mutation、基于旧 state 非函数式更新
- 事件处理：未 preventDefault 导致跳转/刷新；受控/非受控混用
- key 缺失或用 index 做 key（列表可重排时引发错位）

### 2. 类型安全（P0/P1）

- 新代码出现 `any` / `@ts-ignore`（`@ts-expect-error` 需附理由）
- 对外接口 props 类型不完整；API 返回类型与 types 定义漂移
- 可空未判空直接使用（`data!.x` 滥用）

### 3. 性能（P1）

- 渲染期做昂贵计算/深拷贝；无条件 memo 化反而增加开销
- effect 依赖不稳定导致请求风暴；缺 AbortController/清理造成竞态更新
- 大列表无虚拟化；图片无尺寸导致布局抖动

### 4. 用户体验与错误处理（P1）

- loading / error / empty 三态缺失；失败无用户可见反馈
- 操作无状态回显（提交中按钮可重复点击）
- 文案硬编码、截断风险、移动端溢出

### 5. 样式与结构（P1/P2）

- 硬编码颜色/px（应主题令牌）；`!important`、任意值坏味道
- 单文件职责过重（对照 no-god-files）；页面级组件未放功能目录
- 可访问性：交互元素非语义标签、无 focus-visible、图标按钮无 aria-label

## 去误报纪律

同 go-code-review：项目既有约定不算问题（对照 reviewer-memory 误报黑名单）；
发现必须核实到当前文件行号；拿不准定级宁可降一级。

## 输出格式

| 严重度 | 文件:行号 | 维度 | 问题 | 建议 |

末尾给出 `hasP0: yes | no` 与总体评价（安全 | 需修改 | 阻塞）。
