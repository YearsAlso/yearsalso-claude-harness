# 禁止"上帝文件"（God File）

**定义**：单个文件导出超过 10 个互不相关的符号，或在一个文件中堆砌多个领域定义。

## 违规判定（满足任意一条即为上帝文件）

1. **符号过载**：单个文件导出超过 **10 个互不相关的符号**（类型、常量、函数等）
2. **领域混杂**：在一个文件中混合了多个不同职责的定义（如枚举 + DTO + 工具函数）
3. **Schema 堆砌**：多个独立领域的校验 Schema 定义在同一个文件中
4. **定义型 barrel**：聚合文件（`index.ts` / Go doc.go 等）中直接包含类型/常量/Schema 定义，而非仅 re-export / 包注释
5. **入口按对象堆砌**：不同功能场景（public/pipeline/admin）的端点混在同一个 handler 文件中

## 拆分粒度

| 目录 | 拆分维度 | 示例 |
|------|---------|------|
| types/ | 按类别 | `enums.ts`, `dto.ts`, `common.ts` |
| constants/ | 按用途 | `errors.ts`, `limits.ts` |
| schemas/ | 按领域实体 | `auth.schema.ts`, `tag.schema.ts` |

拆分判断以"职责单一"为准；示例路径按项目栈在 `.claude/rules/{stack}/` 中特化。
