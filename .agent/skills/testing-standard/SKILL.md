---
name: testing-standard
description: Use when implementing, fixing, or refactoring behavior in this NestJS and Next.js monorepo, especially authentication, ledger permissions, data access, synchronization, or user-visible flows.
---

# 小宝记账测试规范

## 默认规则

- 行为变更必须在同一次改动中新增或更新自动化测试。
- 纯文案、注释或无行为影响的样式调整可以跳过测试；跳过时在最终说明中写明原因和遗留风险。
- 测试与被测代码就近放置。后端兼容现有 `*.spec.ts`，新增纯逻辑和 Repository 测试优先使用 `*.test.ts`；前端使用 `*.test.ts` 或 `*.test.tsx`。
- 测试名称使用“给定 / 当 / 则”表达业务结果，避免只描述内部实现动作。
- 每个行为至少覆盖成功、空数据、非法输入或异常中的相关分支，不机械追求无意义的行覆盖率。

## 后端测试分层

### 单元测试

使用 Jest 和 `@nestjs/testing`，适用于：

- 金额转换、权限判断、DTO 映射和分页等纯逻辑；
- Service 的业务分支；
- Guard、Pipe、异常映射和幂等逻辑。

Service 测试在 Prisma 边界做浅层 Mock，重点验证查询条件、写入 payload、事务调用和异常，不连接真实生产数据库。

### 接口契约测试

Controller 测试验证：

- HTTP 方法和路由参数对应的 DTO；
- 成功返回的数据结构；
- 认证失败、权限不足、参数非法和资源不存在时的异常；
- 账本接口是否把 `ledgerId` 和当前用户上下文传入 Service。

### 数据库集成测试

涉及 Prisma 事务、唯一约束、级联关系或 Migration 行为时，才引入隔离测试数据库。测试数据必须独立、可清理，不能依赖本地开发数据库中的已有数据。

## 记账业务必测场景

- 未登录用户不能访问用户接口。
- 非成员不能读取或修改账本数据。
- `VIEWER` 不能新增、编辑或删除账单。
- `EDITOR` 不能管理账本成员。
- `OWNER` 不能被移除后造成账本没有 Owner。
- 相同 `clientRequestId` 重试不能创建重复账单。
- 使用旧 `version` 修改账单时必须返回冲突，不得覆盖新数据。
- 跨账本的账户、分类、付款人和账单 ID 必须被拒绝。
- 账单软删除后默认查询不可见，审计信息仍符合约定。

## 前端测试分层

- 当前 Store 和纯函数使用现有轻量测试入口；行为变复杂后再引入 Vitest。
- React 客户端组件引入后使用 Vitest + React Testing Library，优先断言用户可见结果、加载态、空状态、错误和表单校验。
- 依赖服务端 `cookies()`、Middleware 或跨路由跳转的流程使用 Playwright；不要用脆弱的 jsdom 测试强行覆盖 Server Component。
- API 包装层测试请求方法、URL、query、payload、响应映射和错误转换，不要为单个请求 Mock 整个页面。

## Mock 与断言约束

- 每个测试后恢复所有 Mock、Timer、Store 和 Router 状态，测试之间不得共享可变数据。
- 优先使用语义查询；组件测试优先 `getByRole`、`getByLabelText`、`getByText`，异步更新使用 `findBy*`。
- 只有语义查询不可行时才使用 `data-testid`，不依赖 CSS class、Ant Design 内部 DOM 或具体嵌套结构。
- 未经接口文档声明，不自行断言或发送 `If-Match` 等并发控制请求头。
- 外部 JSON、Socket 载荷和 IndexedDB 数据先按 `unknown` 处理，测试应覆盖结构非法时的失败行为。

## 最小验证

仓库根目录默认执行：

```bash
pnpm typecheck
pnpm test
```

按变更范围补充 `pnpm lint`、`pnpm test:coverage` 或已配置的 Playwright 命令。命令无法执行时必须说明原因，不能默认为通过。
