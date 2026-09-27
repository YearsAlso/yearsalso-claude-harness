# Go 代码编写强制约束

> 项目特化的分层路径/目录名写入 profile「栈上下文」与「代码落点」，本规则只收跨 Go 项目通用约束。

## 一、安全红线

1. 禁止硬编码密钥、数据库连接串、端口等敏感字符串，统一通过配置读取
2. 禁止忽略 error 返回值（`_ = err` 或 `val, _ = ...`），必须处理或显式注释忽略原因
3. 禁止 goroutine 无 panic 恢复：所有 `go func()` 必须 `defer recover()` + 错误日志
4. 禁止共享状态无锁保护：map/slice 并发读写必须使用 `sync.Mutex` / `sync.RWMutex`
5. 禁止 `os/exec` 无超时：外部进程调用必须使用 `exec.CommandContext` + timeout
6. 禁止 SQL 字符串拼接：一律走参数化查询 / 代码生成的数据访问层

## 二、包结构与依赖规范

1. 分层依赖方向单一（入口 → 业务模块 → 数据/领域层 → 公共叶子包），禁止循环依赖（项目实际分层图写入 profile）
2. 模块间仅通过约定的接口/事件总线通信，禁止直接 import 兄弟模块内部实现
3. 长生命周期组件实现统一生命周期契约（如 Init/Start/Stop）并由启停器统一管理
4. 事件类型集中在契约文件定义，新增事件先定义后使用
5. DB 访问一律走数据访问层：SQL 独立文件 → 代码生成器 → 生成产物，禁止手写/手改生成文件（生成工具缺失时上报）
6. 迁移文件 `NNN_名称.up.sql` + `.down.sql` 成对出现，序号先 `ls` 核实后顺延，禁止冲突
7. 新增通用工具函数放在对应模块或 pkg/ 下，禁止散落在入口目录

## 三、Go 语法与编码规范

1. 严格遵循 Go 标准命名：camelCase 私有，PascalCase 公开，缩写全大写（URL、CSV、JSON、UDP、ID）
2. 错误处理：禁止空 `if err != nil { return }` 不记录日志；错误必须包含上下文（`fmt.Errorf("...: %w", err)`）
3. 禁止魔法数字、魔法字符串：统一用 `const` 常量定义
4. 函数单一职责：超长函数（>100 行）考虑拆分
5. 使用 `defer` 管理资源清理，但循环内禁止 `defer`（改为显式 Close 或提取函数）
6. context 贯穿调用链：有父 ctx 的调用禁止传 `context.Background()`
7. 代码必须通过 `gofmt` 格式化（`gofmt -l .` 无输出）

## 四、并发与性能约束

1. goroutine 间通信优先使用 channel + context，避免共享内存
2. goroutine 必须有退出路径（context 取消 / channel 关闭），禁止泄漏
3. channel 关闭方唯一，禁止向已关闭 channel 发送
4. 事件 handler 禁止同步阻塞 IO，耗时操作转发到 channel 异步处理
5. 禁止在 HTTP/WebSocket handler 中同步执行耗时操作
6. 长时间运行的缓存（map）必须有容量上限或过期清理机制
7. 涉及并发的改动必须通过 `go test -race ./...`

## 五、交付约束

1. 交付代码不能遗留 `fmt.Println` 调试打印，统一使用项目日志库
2. 禁止遗留注释掉的废弃代码、无意义 TODO
3. 交付前验证闭环：`go build ./...` + `go vet ./...` + `gofmt -l .` + `go test ./...` 全部通过
4. 新功能必须附单元测试（表驱动，覆盖正常/边界/错误路径），参照 go-testing skill

## 六、第三方依赖约束

1. 新增 Go 模块依赖（`go get`）必须先经用户确认，不能直接引入
2. 不私自修改 go.mod 中的版本号
3. CGO 依赖的调用方式变更需先确认
