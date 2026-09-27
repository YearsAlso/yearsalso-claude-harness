# Go 命名规范（zero 风格 DTO 分层）

> 通用骨架取自 go-zero 分层命名约定；项目实际前后缀可写入 profile 微调。

## 命名模式速查

1. **DTO 分层**：请求 `XxxReq` / 响应数据 `XxxData` / 列表项 `XxxItem`，
   handler 结构体 `XxxHandler`（或项目等价命名），Req↔响应配对命名（`AlarmPageReq` ↔ `AlarmPageData`）
2. **文件名**：snake_case（`thickness_calculator.go`），与主类型 PascalCase 对应
3. **包名**：短小写名、避免复数、避免 util/common 式大杂烩
4. **构造函数**：`NewXxx`，返回接口类型或具体类型二选一并保持全库一致
5. **常量**：域前缀 + PascalCase（`SettingUpgradeProgress` / `ModuleStateIdle` / `LightStateOpen`）
6. **接口（svc 端口）**：功能名 + 角色后缀（`SamplingController` / `RuleUpdater` / `RecalcProvider`）

## 边界（哪些命名不动）

1. **路由路径**为前端契约，禁止改动
2. **JSON tag** 为前端契约，禁止改动（重命名字段需同步消费方）
3. 存量代码既有命名不因风格差异做大规模重命名；**新增代码按本规范执行**即可

## 检查方式

- 新增/重命名文件或符号后，逐条核对上表：文件名 snake_case、字段 PascalCase、
  JSON tag camelCase、DTO 后缀、常量域前缀
- 命名决策前先 grep 全库统计各叫法出现次数，跟随多数派（ADR-010 教训）
