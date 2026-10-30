# 小宝记账

支持个人账本和多人共享账本的 PWA 记账应用。

## 项目结构

- `backend/`：NestJS API、Prisma 数据模型和 PostgreSQL 访问层
- `frontend/`：Next.js App Router、Zustand 和 PWA 前端
- `docs/`：技术方向、需求基础和实现计划
- `docker-compose.yml`：本地 PostgreSQL、Redis、NestJS 后端和 Next.js 前端完整开发环境

## 本地启动

### 1. 启动完整 Docker 开发环境

```bash
docker compose up -d --build
```

启动后：

- 前端：`http://localhost:8090`
- 后端：`http://localhost:8091`
- 健康检查：`http://localhost:8091/api/health`
- PostgreSQL：`localhost:5439`
- Redis：`localhost:6389`

查看日志：

```bash
docker compose logs -f backend frontend
```

停止环境：

```bash
docker compose down
```

如果需要前端或后端热更新，再使用各自目录中的 `pnpm run dev`；根目录 Docker Compose 默认运行构建后的服务，便于验证完整容器链路。

### 2. 本地非 Docker 开发

先启动 PostgreSQL 和 Redis：

```bash
docker compose up -d postgres redis
```

然后分别启动后端和前端：

```bash
cd backend
pnpm install
cp .env.example .env
pnpm exec prisma generate
pnpm run start:dev
```

```bash
cd frontend
pnpm install
cp .env.example .env.local
pnpm run dev
```

## 当前范围

当前阶段只搭建基础框架、健康检查、多账本 Prisma 数据模型、Zustand 状态边界和 PWA 壳层。登录、账本接口、邀请、账单和离线同步将在基础框架稳定后分阶段实现。

## 文档

- [文档索引](docs/文档索引.md)
- [技术方向](docs/技术方向.md)
- [需求基础](docs/需求基础.md)
- [用户与成员角色需求](docs/requirements/用户与成员角色需求.md)
- [基础框架搭建计划](docs/superpowers/plans/2026-10-30-基础框架搭建计划.md)
