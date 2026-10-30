# 小宝记账项目开发约束

本文件是当前单仓库的项目级开发约束。修改后端、前端、数据库模型、接口契约或部署配置前，应先阅读与任务对应的 `.agent/skills/` 技能文件。

## 项目边界

- `backend/` 是 NestJS API 服务，负责认证、账本权限、账单业务和统计。
- `frontend/` 是 Next.js App Router PWA，负责页面、客户端状态和离线交互。
- `docs/` 保存产品需求、技术方向和开发计划。
- 根目录 `docker-compose.yml` 负责本地全栈编排；生产部署由 Docker Compose 与 Nginx 配合完成。

参考项目中的注册码、设备授权、MQTT、TCP、脚本日志和 AI Agent 不属于本项目，除非需求明确变更，否则不要引入。

## 通用规则

- 使用中文编写用户可见文案、接口说明、关键注释和提交信息。
- TypeScript 开启严格模式；公共接口禁止使用未解释的 `any`。
- 所有账本资源都必须经过账本成员关系和角色权限校验，不能只相信客户端传入的 `ledgerId`。
- 金额统一使用整数分；禁止在业务层使用浮点数计算金额。
- 新增账单使用客户端幂等 ID；修改账单使用版本号或更新时间检测并发冲突。
- 财务数据默认软删除，重要变更保留审计信息。
- 生产数据库只使用 Prisma Migration，不在启动命令中执行有数据丢失风险的 `db push`。
- 修改完成后，至少运行受影响应用的类型检查、Lint、测试或生产构建中的相关验证。

## 技能路由

- 修改 NestJS、Prisma、认证、账本接口或同步逻辑：阅读 `backend-dev-guide` 和 `typescript-type-convention`。
- 修改 Next.js 页面、Axios、Zustand、PWA 或离线队列：阅读 `frontend-dev-guide` 和 `typescript-type-convention`。
- 新增或重构代码时：阅读 `commenting-convention`。
- 准备提交时：阅读 `commit-convention`，并根据实际 diff 编写提交正文。
