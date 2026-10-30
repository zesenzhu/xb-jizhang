# 记账 App 基础框架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可本地启动、可构建、可扩展多人共享账本的 NestJS 后端和 Next.js PWA 前端基础框架。

**Architecture:** 前后端分离，后端提供 `/api/health` 健康检查并用 Prisma Schema 固化 User、Ledger、LedgerMember 等核心关系；前端使用 Next.js App Router、Zustand、Axios 和手写基础 Service Worker，暂不实现完整记账业务。生产和本地部署使用独立的 Docker Compose 配置，服务端口与旧项目隔离。

**Tech Stack:** NestJS 11、TypeScript、Prisma、PostgreSQL、Redis、Next.js 16、React 19、Zustand、Axios、Tailwind CSS、PWA Manifest/Service Worker、Docker Compose。

**Spec:** `docs/technical-direction.md`、`docs/requirements-baseline.md`

## Global Constraints

- 第一版采用多账本模型，个人账本是只有一个主要成员的账本实例。
- 业务数据通过 `LedgerMember` 归属账本，不直接只绑定用户。
- 账本角色使用 `OWNER`、`EDITOR`、`VIEWER`。
- 金额字段使用整数分，暂不实现完整记账接口。
- 后端端口使用 `8091`，前端端口使用 `8090`，避免与旧项目的 `8080/8081` 冲突。
- 生产数据库必须使用 Prisma Migration，不在启动命令中执行 `db push --accept-data-loss`。
- 代码注释和用户可见文案使用中文，TypeScript 保持严格类型。

### Task 1: Create repository-level project metadata

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `docker-compose.yml`

- [x] **Step 1: Write the project metadata**

Add ignore rules for dependency directories, build output, environment files, local databases, and runtime uploads. Document the two application directories and the local Docker services/ports. Define a root Compose file that starts PostgreSQL and Redis only, so backend and frontend can run in watch mode outside Docker.

- [x] **Step 2: Verify metadata**

Run: `docker compose config`

Expected: Compose configuration renders successfully when Docker is available; if Docker is unavailable, inspect the YAML with a parser and report that limitation.

### Task 2: Scaffold NestJS backend and test health behavior

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/tsconfig.build.json`
- Create: `backend/nest-cli.json`
- Create: `backend/src/main.ts`
- Create: `backend/src/app.module.ts`
- Create: `backend/src/health/health.controller.ts`
- Create: `backend/src/health/health.service.ts`
- Create: `backend/src/health/health.controller.spec.ts`
- Create: `backend/src/modules/prisma/prisma.module.ts`
- Create: `backend/src/modules/prisma/prisma.service.ts`
- Create: `backend/prisma/schema.prisma`
- Create: `backend/prisma.config.ts`
- Create: `backend/.env.example`
- Create: `backend/Dockerfile`

- [x] **Step 1: Write the failing health test**

Test that `GET /api/health` returns `status: "ok"`, an application name, and an ISO timestamp by exercising the real controller and service.

- [x] **Step 2: Run the health test and confirm RED**

Run: `cd backend && pnpm install && pnpm exec jest src/health/health.controller.spec.ts --runInBand`

Expected: FAIL because the health module files do not yet exist or do not expose the expected response.

- [x] **Step 3: Implement the minimal backend**

Create NestJS bootstrap with global `/api` prefix, validation pipe, CORS configuration, health endpoint, Prisma module, and Prisma schema for User, Ledger, LedgerMember, LedgerInvitation, Account, Category, Transaction, TransactionAuditLog, and Budget. Use `Decimal` nowhere for money; all money columns are integer fields in cents. Add a production Dockerfile that runs `prisma migrate deploy` before the compiled server, without `db push --accept-data-loss`.

- [x] **Step 4: Run the focused test and confirm GREEN**

Run: `cd backend && pnpm exec jest src/health/health.controller.spec.ts --runInBand`

Expected: PASS.

- [x] **Step 5: Verify Prisma generation and TypeScript build**

Run: `cd backend && pnpm exec prisma generate && pnpm run build`

Expected: both commands exit with code 0.

### Task 3: Scaffold Next.js frontend, Zustand store, API client, and PWA shell

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.ts`
- Create: `frontend/next-env.d.ts`
- Create: `frontend/src/app/layout.tsx`
- Create: `frontend/src/app/page.tsx`
- Create: `frontend/src/app/globals.css`
- Create: `frontend/src/components/layout/AppShell.tsx`
- Create: `frontend/src/components/layout/ServiceWorkerRegistration.tsx`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/store/useAppStore.ts`
- Create: `frontend/public/manifest.webmanifest`
- Create: `frontend/public/sw.js`
- Create: `frontend/public/icons/icon-192.svg`
- Create: `frontend/public/icons/icon-512.svg`
- Create: `frontend/.env.example`
- Create: `frontend/Dockerfile`

- [x] **Step 1: Write the frontend contract test**

Add a small TypeScript test script that imports the app store factory and verifies that the default active ledger state is `null` and that `setActiveLedger` stores a ledger summary. This keeps the first client-side state contract executable without introducing a full UI test framework.

- [x] **Step 2: Run the contract test and confirm RED**

Run: `cd frontend && pnpm install && pnpm run test:contract`

Expected: FAIL because the store and test script do not yet exist.

- [x] **Step 3: Implement the frontend foundation**

Create a mobile-first app shell with a current-ledger placeholder, health status fetch through Axios, Zustand state for current ledger and online status, manifest metadata, and a production-only Service Worker registration. Keep the home screen as a usable foundation view rather than a marketing page.

- [x] **Step 4: Run the contract test and production build**

Run: `cd frontend && pnpm run test:contract && pnpm run build`

Expected: both commands exit with code 0.

### Task 4: Add local development and deployment configuration

**Files:**
- Create: `backend/docker-compose.dev.yml`
- Create: `backend/docker-compose.prod.yml`
- Create: `frontend/docker-compose.dev.yml`
- Create: `frontend/docker-compose.prod.yml`
- Create: `docker/nginx/jizhang.conf.example`

- [x] **Step 1: Add isolated service names and ports**

Use `jizhang-db`, `jizhang-redis`, `jizhang-backend`, and `jizhang-frontend` naming. Use backend `8091` and frontend `8090` on the host. Keep PostgreSQL unexposed in the production Compose file unless explicitly needed for maintenance.

- [x] **Step 2: Add Nginx routing example**

Route `jizhang.xiaobao.work/api/` to backend `8091` and all other requests to frontend `8090`, with WebSocket upgrade headers reserved for future realtime synchronization.

- [x] **Step 3: Validate configuration**

Run: `docker compose -f backend/docker-compose.dev.yml config` and `docker compose -f frontend/docker-compose.prod.yml config` when Docker is available. Also run `pnpm run build` in both applications.

### Task 5: Final verification

**Files:**
- Modify: `docs/technical-direction.md`
- Modify: `docs/requirements-baseline.md`

- [x] **Step 1: Check the documented commands against package scripts**

Confirm the README commands, backend scripts, frontend scripts, ports, Prisma schema relationships, and PWA paths agree.

- [x] **Step 2: Run the complete verification set**

Run backend unit tests, Prisma generation, backend build, frontend contract test, and frontend production build. Start both dev servers only if needed for a smoke check, then stop the processes before completion.

- [x] **Step 3: Report evidence and remaining scope**

Report exact commands and outcomes. State clearly that authentication, ledger APIs, invitations, transactions, and offline synchronization are foundation follow-ups rather than completed business features.
