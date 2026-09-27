---
name: go-code-review
description: Go 代码审查维度清单 — 正确性/并发安全/资源清理/安全性/可维护性逐维度检查表与去误报纪律。reviewer 与后端工程师自检时使用。
---

# Go Code Review Skill

## 审查维度清单（逐维度过，每条发现 Read/Grep 核实）

### 1. 正确性与边界（P0）

- error 丢弃：`_ = err` / 多返回值忽略；`if err != nil` 后必须处理或包装上下文（`fmt.Errorf("...: %w", err)`）
- nil map 写入、空 slice 索引、类型断言无 ok 分支
- 数值：除零、溢出、浮点比较精度；时间：时区、单调时钟
- 协议/编解码：长度字段与实际 payload 不符、字节序、校验和边界

### 2. 并发安全（P0）

- 共享 map/slice 并发读写无锁
- goroutine 无 `defer recover()` + 错误日志
- channel：关闭方不唯一、向已关闭 channel 发送、无退出路径泄漏（缺少 context/quit）
- 死锁：嵌套锁顺序不一致；锁内做阻塞 IO
- 状态机非法跳转、超时缺失

### 3. 资源清理（P0/P1）

- `defer Close()` 缺失；**循环内 defer**（应显式 Close 或提取函数）
- 事务缺 Rollback 兜底；`os/exec` 无超时（应 `exec.CommandContext`）
- context 未贯穿调用链（有父 ctx 却传 `context.Background()`）

### 4. 安全性（P0）

- 硬编码密钥/连接串/端口（应走配置）
- SQL 字符串拼接（应参数化/生成器）
- 鉴权缺失/越权、外部输入未校验、路径穿越

### 5. 可维护性（P1/P2）

- 命名：缩写全大写（URL/ID/CSV）、PascalCase 公开 / camelCase 私有
- 魔法数字/字符串（应 const）；超长函数（>100 行考虑拆分）
- `fmt.Println` 调试残留（应走统一日志库）；注释掉的废弃代码
- 分层：绕过数据访问层、直接 import 兄弟模块内部实现

## 去误报纪律

1. 本项目既有约定/无影响写法不算问题（对照 reviewer-memory 误报黑名单）
2. 每条发现必须标注**当前文件**的 文件:行号（非 diff 行号），且 Read 核实该行真实如此
3. 拿不准的惯用法先对照 cheatsheet/官方 effective_go，禁止凭印象定 P0

## 输出格式

| 严重度 | 文件:行号 | 维度 | 问题 | 建议 |

末尾给出 `hasP0: yes | no` 与总体评价（安全 | 需修改 | 阻塞）。
