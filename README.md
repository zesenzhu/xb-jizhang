# 小宝记账

支持个人账本和多人共享账本的 PWA 记账应用。

## 项目结构

- `backend/`：NestJS API、Prisma 数据模型和 PostgreSQL 访问层
- `frontend/`：Next.js App Router、Zustand 和 PWA 前端
- `docs/`：技术方向、需求基础和实现计划
- `docker-compose.yml`：本地 PostgreSQL 与 Redis 基础服务

## 本地启动

### 1. 启动基础服务

```bash
docker compose up -d
```

### 2. 启动后端

```bash
cd backend
pnpm install
cp .env.example .env
pnpm exec prisma generate
pnpm run start:dev
```

后端默认地址：`http://localhost:8091`
健康检查：`http://localhost:8091/api/health`

### 3. 启动前端

```bash
cd frontend
pnpm install
cp .env.example .env.local
pnpm run dev
```

前端默认地址：`http://localhost:8090`

## 当前范围

当前阶段只搭建基础框架、健康检查、多账本 Prisma 数据模型、Zustand 状态边界和 PWA 壳层。登录、账本接口、邀请、账单和离线同步将在基础框架稳定后分阶段实现。

## 文档

- [技术方向](docs/technical-direction.md)
- [需求基础](docs/requirements-baseline.md)
- [基础框架实现计划](docs/superpowers/plans/2026-10-30-foundation-scaffold.md)
