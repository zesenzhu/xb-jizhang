---
name: backend-dev-guide
description: Use when adding or changing NestJS modules, Prisma models, DTOs, authentication, ledger APIs, synchronization, or database migrations in this repository.
---

# 记账项目后端开发技能

## 核心约束

- Controller 只负责路由、DTO 和响应状态，业务规则放在 Service。
- 所有输入使用明确 DTO 和 `class-validator`；全局 `ValidationPipe` 保持 `whitelist: true`、`transform: true`。
- 所有账本数据访问必须先完成成员身份校验，再执行资源查询或写入。成员角色不能只在前端判断。
- 账单创建、修改、删除和转账必须在 Prisma transaction 中维护业务不变量。
- 金额以整数分保存；转账必须同时校验转出账户、转入账户、余额口径和账户归属。
- `clientRequestId` 用于账单幂等；`version` 或 `updatedAt` 用于乐观锁。重复请求应返回已存在的业务结果，而不是重复写入。
- 账单默认软删除；账户和分类优先停用。涉及财务数据的变更应写入审计日志。

## 数据库与基础设施

- Prisma 关系显式声明 `fields`、`references` 和合适的 `onDelete`。
- 高频查询按 `ledgerId` 设计联合索引，常见组合包括时间、类型、分类、付款人和状态。
- 本地开发可以使用 `db push`，生产和共享环境必须使用可审查的 Migration。
- Redis 只承载短期数据：限流、邀请过期、幂等锁、同步锁和必要的缓存。不要把 Redis 当作账单主存储。
- WebSocket 仅在共享账本实时更新确有需求时引入。加入 `ledger:{ledgerId}` 房间前必须校验成员身份；多实例部署时使用 Redis Adapter。

## 接口与安全

- 认证使用 HttpOnly Cookie；Refresh Token 不从 localStorage 或普通请求参数中读取。
- 生产 CORS 使用明确白名单，不使用 `origin: '*'` 或无约束的动态反射。
- 业务异常使用 NestJS 标准异常，禁止裸抛 `Error`。
- 公共响应结构、错误码和分页格式要保持稳定，并由全局机制统一处理，Controller 不重复包装。
- 需要时在非生产环境提供 Swagger/Scalar，DTO 与接口描述保持同步。

## 验证重点

新增或修改业务后至少覆盖：无成员访问、角色越权、重复幂等请求、并发修改、软删除过滤、跨账本 ID 越权和金额边界。
