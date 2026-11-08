# 小宝记账

支持个人账本和多人共享账本的 PWA 记账应用。

## 项目结构

- `backend/`：NestJS API、Prisma 数据模型和 PostgreSQL 访问层
- `frontend/`：Next.js App Router、Zustand 和 PWA 前端
- `docs/`：技术方向、需求基础和实现计划
- `docker-compose.infra.yml`：本地 PostgreSQL 和 Redis 基础设施
- `docker-compose.yml`：后端、前端和基础设施的完整容器链路
- `scripts/dev.mjs`：本地开发进程编排脚本

## 本地启动

### 1. 推荐：本地热更新开发

前置条件：Node.js 22、pnpm、Docker Desktop。

首次使用时可以准备环境变量文件；文件存在时，Prisma、NestJS 和 Next.js 会按各自的 dotenv 规则原生加载：

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
pnpm --dir backend install
pnpm --dir frontend install
```

如果不需要自定义配置，可以直接执行 `pnpm dev`；仅当对应环境文件不存在时，脚本才会注入与 `.env.example` 一致的本地开发默认值。Shell 环境变量仍然优先于环境文件。不要把真实密码、Token 或生产配置写入仓库。

启动开发环境：

```bash
pnpm dev
```

该命令会自动完成：

- 启动 Docker 中的 PostgreSQL 和 Redis；
- 执行待应用的 Prisma Migration；
- 启动 NestJS `start:dev`，监听后端源码变化；
- 启动 Next.js `dev`，支持前端热更新。

访问地址：

- 前端：`http://localhost:8090`
- 后端：`http://localhost:8091`
- 健康检查：`http://localhost:8091/api/health`
- PostgreSQL：`localhost:5439`
- Redis：`localhost:6389`

按 `Ctrl+C` 会停止本次启动的前后端进程，PostgreSQL 和 Redis 会继续运行。停止基础设施：

```bash
pnpm docker:infra:down
```

### 3. 本地前端连生产接口

只想改前端、又不想起本地后端时，可以让开发服务器直接对生产接口：

```bash
pnpm fat      # 等价于 pnpm dev:prod、pnpm prod
```

该命令只启动 Next 开发服务器（默认 `http://localhost:8090`），并把 `/api/*` 通过 Next 的 rewrites 代理到 `https://jizhang.xiaobao.work`：

- 浏览器访问的始终是同源 `/api`，所以生产 Cookie（`SameSite=Lax`）能正常带上；直接写死生产域名会被浏览器当成跨站请求，登录态失效。
- 不启动 Docker 和本地后端，不需要本地数据库。
- 连接的是**生产数据**，记账、邀请、删除都会真实落库，操作前确认账本。
- 需要临时指向别的环境时加参数：`pnpm dev:prod --api=https://staging.example.com`。

如果只需要启动基础设施：

```bash
pnpm docker:infra:up
```

### 2. 完整 Docker 链路验证

```bash
pnpm docker:full:up
```

该命令会构建并启动 PostgreSQL、Redis、NestJS 和 Next.js 容器，适合验证容器链路或模拟部署环境。它使用构建后的镜像，不会像 `pnpm dev` 一样实时读取源码变化。

查看容器地址：

- 前端：`http://localhost:8090`
- 后端：`http://localhost:8091`
- 健康检查：`http://localhost:8091/api/health`
- PostgreSQL：`localhost:5439`
- Redis：`localhost:6389`

查看日志：

```bash
pnpm docker:full:logs
```

停止环境：

```bash
pnpm docker:full:down
```

从完整 Docker 链路切换到 `pnpm dev` 前，先停止完整链路，避免端口和容器名称冲突：

```bash
pnpm docker:full:down
pnpm dev
```

## 当前范围

当前已完成基础框架、健康检查、普通用户认证、账本成员角色、邀请流程、Zustand 状态边界和 PWA 壳层。账户、分类、账单和离线同步按 `docs/` 中的需求和技术设计分阶段实现。

## 文档

- [文档索引](docs/文档索引.md)
- [技术方向](docs/技术方向.md)
- [需求基础](docs/需求基础.md)
- [用户与成员角色需求](docs/requirements/用户与成员角色需求.md)
- [账户与分类需求](docs/requirements/账户与分类需求.md)
- [账单需求](docs/requirements/账单需求.md)
- [账户与分类接口](docs/api/账户与分类接口.md)
- [账单接口](docs/api/账单接口.md)
- [生产部署说明](docs/部署/生产部署说明.md)
- [基础框架搭建计划](docs/superpowers/plans/2026-10-30-基础框架搭建计划.md)
