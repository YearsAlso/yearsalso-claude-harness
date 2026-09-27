# 接口/组件按功能场景分组（Web 栈）

后端 handler 与前端页面文件**禁止按领域对象堆砌**，必须按**页面/功能场景**拆分。

## 违规示例

```typescript
// ❌ modules/version/version.handler.ts
export const publicVersionHandler = ...   // 公开下载页
export const pipelineVersionHandler = ... // CI/CD 流水线
export const adminVersionHandler = ...    // 管理后台
// 三个不同鉴权模式、不同功能场景的端点混在一个文件
```

## 合规示例

```
✅ modules/
├── public/download.handler.ts     # 下载页端点
├── pipeline/upload.handler.ts     # 流水线端点
├── pipeline/query.handler.ts
├── admin/version.handler.ts       # 管理后台端点
├── admin/tag.handler.ts
└── admin/changelog.handler.ts
```

## 拆分原则

- Handler 文件 → 按**功能场景**（public / pipeline / admin 等），不同鉴权模式端点禁止混同一文件
- Service 文件 → 按**领域对象**，与路由解耦，可被多个 handler 复用
- 一个 handler 文件只服务于一个 API 组 / 一个框架实例
- 前端同理：`pages/{feature}/` 功能目录组织，页面级组件与 hooks 就近放置
