---
name: gopl-programming-language
description: Go 惯用法参考索引（《The Go Programming Language》知识卡）— 并发/接口/错误处理等惯用法拿不准时按主题索引读对应章节，不全量加载。本插件仅内置索引与速查；全文知识卡请用 /add-book-ref 从既有项目安装。
---

# GoPL 惯用法参考（索引桩）

## 使用时机

实施/审查中遇到以下争议，先查本 skill 速查，再按需读加装的知识卡：
接口设计、并发模型（CSP vs 互斥锁）、错误处理策略、reflect/低层编程。

## 决策速查（内核）

- **接口** — 小接口组合优于大接口；接口定义在**消费者侧**；接受具体类型、返回接口类型
- **并发选型** — 共享状态用互斥锁（简单可证明正确）；通信/流水线/取消用 channel + context；"通过通信共享内存" ≠ 禁止共享内存，禁止的是无保护共享
- **goroutine** — 每条 goroutine 必须有退出路径与 panic 恢复；生命周期须有明确归属（谁负责关闭）
- **错误** — 包装 `%w` 保留链；哨兵错误 vs 类型错误 vs 直接比较的取舍
- **defer** — 循环内 defer 是资源泄漏味道；defer 参数即时求值、执行延迟

## 主题 → 章节索引（知识卡加装后可用）

| 主题 | 章节文件 |
|------|---------|
| 程序结构/表达式 | ch02-program-structure.md |
| 复合类型（slice/map 底层语义） | ch04-composite-types.md |
| 函数与错误处理 | ch05-functions.md |
| 方法与接口 | ch06/ch07 |
| goroutine 与 channel | ch08-goroutines-channels.md |
| 共享变量并发 | ch09-concurrency-shared-variables.md |
| 包与工具链 | ch10-packages-tools.md |
| 测试 | ch11-testing.md |
| reflect / 低层 | ch12/ch13 |

> 完整章节/cheatsheet/glossary 不在插件内分发（卷量大且属项目资产）。
> 在装有该知识库的项目执行 `/add-book-ref` 导出，或将目录复制到
> `~/.claude/skills/gopl-programming-language/` 后本 skill 自动可用。
