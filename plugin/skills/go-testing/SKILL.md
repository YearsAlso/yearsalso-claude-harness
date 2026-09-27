---
name: go-testing
description: Go 测试编写规范 — 表驱动单元测试、httptest 接口测试、竞态检测、红→绿回归修复。编写/执行 Go 测试时使用。
---

# Go Testing Skill

## 使用时机

1. 为新功能编写单元测试
2. Bug 修复前补复现用例（红→绿）
3. 执行测试并判定结果

## 硬性纪律

1. **必须实跑** — 实际执行 `go test ./...`，以真实输出为准，不得凭代码走读判定通过
2. **红→绿** — Bug 修复先写能复现 Bug 的失败用例，再修复使其通过
3. **禁跳过** — 不使用 `t.Skip` 掩盖失败；不靠测试缓存侥幸通过（必要时 `-count=1`）

## 测试模式

### 表驱动测试（默认模式）

```go
func TestParseFrame(t *testing.T) {
    tests := []struct {
        name    string
        input   []byte
        want    Frame
        wantErr bool
    }{
        {"正常帧", validFrame, expectedFrame, false},
        {"空输入", nil, Frame{}, true},
        {"长度字段超出 payload", overflowFrame, Frame{}, true},
        {"CRC 错误", badCRCFrame, Frame{}, true},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := ParseFrame(tt.input)
            if tt.wantErr {
                if err == nil { t.Fatalf("期望错误，实际得到 nil") }
                return
            }
            if err != nil { t.Fatalf("意外错误: %v", err) }
            if got != tt.want { t.Errorf("got %+v, want %+v", got, tt.want) }
        })
    }
}
```

覆盖要求：正常路径 / 边界值 / 错误路径 三类各至少一条用例。

### 接口测试

HTTP handler 用 `httptest.NewRecorder` + 构造请求；外部依赖以接口注入 fake，
禁止测试连真实 DB/网络（集成测试显式 build tag 隔离）。

### 并发与竞态

- 涉及 goroutine/channel/共享状态的改动必须 `go test -race ./...`
- 用 `sync.WaitGroup`/channel 做确定性同步，禁止用 `time.Sleep` 等竞态"碰运气"

## 常用命令

```bash
go test ./...                                    # 全量单测
go test ./internal/xxx/... -run TestXxx -v       # 定向用例
go test -race ./...                              # 竞态检测
go test -count=1 ./...                           # 禁用测试缓存
go test -coverprofile=coverage.out ./...         # 覆盖率
```
