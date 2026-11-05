---
title: 前端设计索引
type: index
status: draft
version: 0.3
owner: 小宝
updatedAt: 2026-11-04
---

# 前端设计索引

## 组织原则

**一个页面一个文件，文件自包含。** 改一个页面只改它自己那份文件，不跨文件联动。

每个页面文档固定包含六节，不增不减：

1. 页面结构与布局
2. 数据来源（接口、类型、缓存键）
3. 交互规则
4. 状态矩阵
5. 组件清单（复用 / 扩展 / 新建）
6. 验收清单

跨页面共用的内容（后端缺口、全局样式约束、通用组件契约）统一放在本文件，页面文档只引用不重复。

## 页面文档

| 页面 | 路由 | 文档 | 状态 |
| --- | --- | --- | --- |
| 账本页 | `/user` | [账本页.md](./账本页.md) | 二期已交付（顶部切换、筛选面板、下钻、二期概览） |
| 记账抽屉 | `/user` 浮层 | [记账抽屉.md](./记账抽屉.md) | 已交付 |
| 分类选择 | 记账抽屉中部内联 | [分类选择.md](./分类选择.md) | 已交付 |
| 账单详情 | `/user` 浮层 | [账单详情.md](./账单详情.md) | 已交付 |
| 分类管理 | 记账面板内 | [分类管理.md](./分类管理.md) | 已交付 |
| 我的账本 | `/user/ledgers` | [我的账本.md](./我的账本.md) | 二期已交付 |
| 账本设置 | `/user/ledgers/:id/settings` | [账本设置.md](./账本设置.md) | 二期已交付 |
| 成员与邀请 | `/user/ledgers/:id/members` | [成员与邀请.md](./成员与邀请.md) | 二期已交付 |
| 统计页 | `/user/statistics` | [统计页.md](./统计页.md) | 二期已交付 |
| 我的页面 | `/user/profile` | [我的页面.md](./我的页面.md) | 二期已交付 |
| 我的邀请 | `/user/invitations` | 见本文「邀请处理」 | 二期已交付（Token 链接入口） |
| 筛选面板 | `/user` 浮层 | 见本文「筛选模型」 | 二期已交付 |

## 二期导航变化

底部主导航从「明细 / 账本 / 记账 / 统计 / 我的」改为**「账本 / 统计 / 我的」三项**（需求 5.1）：

| 项 | 路由 | 说明 |
| --- | --- | --- |
| 账本 | `/user` | 当前账本流水与概览 |
| 统计 | `/user/statistics` | 新建页面 |
| 我的 | `/user/profile` | 已有页面 |

变更要点：

- 移除独立的「明细」入口（账本页即明细）和底栏中央「记账」入口；记账只保留账本页右下角 FAB。
- **移除「资产」入口**。二期没有资产功能，不提供资产页或资产趋势（需求 4.2）。
- 二级页面（我的账本、账本设置、成员管理）隐藏底栏，靠页面内返回。
- `routes.ts` 的 `UserPrimaryTab` 与 `USER_PRIMARY_TAB_ROUTES` 需要同步改；`MobileBottomNav` 的 `quickAdd` 逻辑移除。

**参考截图里统计页底栏显示「账本 / 资产 / 统计」，与需求冲突，以需求为准。**

## 后端能力现状（二期）

对 `backend/src`、`prisma/schema.prisma` 与 `docs/api/` 的逐项比对。**接口文档已进入 `review`，后端正在补实现；本表在每次后端提交后复核。**

### 已具备（前端可直接用）

| 能力 | 接口 | 证据 |
| --- | --- | --- |
| 账单创建/编辑/软删除/详情 | `POST/PATCH/DELETE/GET /ledgers/:id/transactions[/:tid]` | 一期已交付 |
| 账单列表与筛选 | `GET /ledgers/:id/transactions` | 支持 `type/categoryId/categoryRootId/uncategorized/accountId/payerId/from/to/keyword` |
| 收支概览（一期口径） | `GET /ledgers/:id/statistics/overview` | 返回 `totalIncomeCents/totalExpenseCents/netCents/transactionCount` |
| 账户与分类 CRUD | `/ledgers/:id/accounts`、`/categories` | 一期已交付 |
| 成员列表与角色 | `GET /ledgers/:id/members`、`PATCH .../role` | 一期已交付 |
| 邀请（发起/接受/拒绝/撤销） | `POST /ledgers/:id/invitations` 等 | 一期已交付 |
| 成员移除/退出/转移 | `DELETE .../members/:mid`、`POST .../leave`、`POST .../ownership-transfer` | 一期已交付 |
| 账本 CRUD | `GET/POST/PATCH /ledgers` | 一期已交付 |

### 二期缺口（截至当前 HEAD 的复核结果）

P1–P9 已全部由后端实现（`Ledger.timezone`、`UserLedgerPreference` 与偏好接口、`POST /ledgers/:id/copy`、`DELETE /ledgers/:id`、统计四接口、账单列表分类根节点和未分类筛选、`LedgerSummary.memberCount`、账本内待处理邀请查询），前端已直接消费。账本内待处理邀请仅允许共享账本 Owner 查询，服务端读取时会把过期邀请标记为 `EXPIRED`。

| # | 缺口 | 证据（当前 HEAD） | 前端处理 |
| --- | --- | --- | --- |
| P5 | `GET /ledgers/:id/invitations`（账本内待处理邀请） | 已实现；仅共享账本 Owner 可查询，读取时标记过期邀请 | 成员与邀请页展示服务端完整待处理列表；本次会话内新建的邀请仍可使用一次性链接 |

### 一期遗留缺口

| # | 缺口 | 影响 | 处理 |
| --- | --- | --- | --- |
| B3 | 账本时区 | 前端硬编码 `Asia/Shanghai` | 由 P1 解决 |
| B4 | 无 `restore` 接口 | 删除后不能撤销 | 二期不做撤销 |
| B5 | 无 `createdById` 筛选 | 不能按记账人筛 | 延后 |
| B6 | 关键词不匹配分类名 | 搜「餐饮」搜不到 | 延后 |

## 二期前端实施顺序与交付状态

| 批次 | 内容 | 状态 |
| --- | --- | --- |
| 1 | 底部导航改三项、`routes.ts` 同步、移除 quickAdd | 已交付 |
| 2 | 账本页顶部切换按钮、筛选面板与下钻、二期概览；我的账本页 | 已交付 |
| 3 | 账本设置页、成员与邀请页、我的页面、我的邀请 | 已交付 |
| 4 | 统计页 | 已交付 |

**不要在接口就绪前用前端聚合顶替**——统计口径必须服务端唯一，否则会与账单页数字不一致。

## 全局样式约束

### 颜色

只允许三类来源：

1. `globals.css` `@theme` 定义语义类名（`bg-app-card`、`text-primary`、`text-financial-expense` 等）；
2. Tailwind 内置中性色（`slate` / `zinc`），仅用于骨架与遮罩；
3. 深色概览卡的少量硬编码需先抽成 token。

**禁止**：新增未定义的 `*-ios-*` 类名；业务组件写 `bg-[#xxxxxx]`；同一语义在不同页面用不同色值。

### 既有失效项（改样式时容易误判）

| 项 | 位置 | 状态 |
| --- | --- | --- |
| `text-ios-blue` / `from-ios-blue` / `shadow-ios-blue/*` | `AuthCard`、`UserAuthEntry`、`SyncStatusBar` 共 10+ 处 | `--color-ios-blue` 未定义，**静默无效** |
| `animate-in` / `fade-in` / `zoom-in-95` | `dialog.tsx`、`SyncStatusBar`、`AuthCard` | 未安装 `tailwindcss-animate`，**静默无效** |
| `AmountDisplay` 颜色 | `common/AmountDisplay.tsx` | 硬编码 `text-emerald-400`/`text-rose-400`，未用 token |
| `.pb-safe` fallback | `globals.css` | 固定 20px，桌面端凭空多间距；改用显式 `env()` |
| `AmountKeypad` 内嵌 `pb-safe` | `mobile/AmountKeypad.tsx` | 已通过 `insetSafeArea={false}` 在抽屉内关闭 |

### 层级

| 层 | z-index |
| --- | --- |
| 页面内容 | 0 |
| FAB | 30 |
| 底栏 `MobileBottomNav` | 40 |
| 抽屉 / 详情面板 | 50 |
| 分类选择（已内联，不再占层） | — |
| Toast | 70 |

### 安全区

页面容器 `pb-[calc(4rem+env(safe-area-inset-bottom))]`；FAB `bottom-[calc(5rem+env(safe-area-inset-bottom))]`；抽屉底部 `pb-[env(safe-area-inset-bottom)]`，键盘不重复加。

## 通用组件约定

### `BottomSheet`

```text
BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  layer?: 'base' | 'nested'   // nested 用于二级浮层
  variant?: 'sheet' | 'full'  // full 为全屏三段式（顶部固定/中部滚动/底部固定）
  onBeforeClose?: () => boolean  // 返回 false 阻止关闭（未保存确认）
  children: React.ReactNode
}
```

实现要求：`createPortal` 挂到 `body`；打开时保存并设置 `body.overflow`，关闭时恢复原值；焦点进入面板，关闭后归还触发元素；`Esc` 与遮罩点击都经过 `onBeforeClose`；不实现下滑手势（与列表滚动冲突）。

### `Toast`

```text
toast.success('已保存')
toast.error('保存失败，请重试')
toast.action('已删除', { label: '撤销', onClick })
```

单例容器挂载在 `UserNavShell` 内，`z-70`。同时最多 1 条，后入覆盖先入。

### 金额转换

`lib/bill/amount.ts` 纯函数：`amountText ↔ amountCents`，用字符串处理，禁止浮点乘法参与业务判断。

## 页面归属决策

- **账本页**：`/user` 承载当前账本流水，不新建 `/user/ledger/[id]/transactions`。单页账本视图（账本名 + 月份 + 分组）符合参考设计；多一层路径会让「打开即记账」变慢，且同一份账单会有两个 URL 入口。
- **我的账本**：独立二级页 `/user/ledgers`，不在首页展开账本列表（需求 6.1）。
- **账本设置 / 成员与邀请**：独立二级页，从「我的账本」卡片菜单进入。
- **统计页**：独立一级页 `/user/statistics`，与账本页共用 `currentLedgerId`，但各自维护时间范围。
- **旧路由保活**：二期把账本列表迁到 `/user/ledgers`（二级页），旧路径用服务端重定向保留，避免书签与历史链接失效：
  - `/user/ledger` → `/user/ledgers`
  - `/user/ledger/new` → `/user/ledgers?create=1`
  - `/user/ledger/:ledgerId` → `/user/ledgers/:ledgerId/settings`

## 筛选模型

账本页的筛选统一收敛到 `lib/bill/bill-filters.ts` 的 `BillFilter`：

```text
{ keyword, payerId, type, categoryRootId, categoryId, accountId, from, to }
```

- `categoryId` 与 `categoryRootId` 互斥（服务端限制），发请求时精确分类优先。
- `from`/`to` 是 **UTC 半开区间**，与统计接口的 `startAt`/`endAt` 同口径；面板里编辑的是账本时区的本地日期，由 `withBillFilterDates`/`billFilterDates` 双向换算。
- 列表与概览共用同一份筛选：`toBillFilterQuery`（列表，含 `from`/`to`）与 `toStatisticsFilterQuery`（概览，剔除 `from`/`to`，因为统计的时间边界只能由 `period` 表达）。
- 自定义时间范围优先于月份导航：范围生效时两个月份箭头禁用，概览卡显示区间与「清除时间范围」。
- 统计下钻参数（`startAt`/`endAt`/`type`/`categoryRootId`/`categoryId`/`uncategorized`/`accountId`/`payerId`/`keyword`）由 `lib/bill/bill-drilldown.ts` 解析；参数非法时整体退化为默认当月，不报错。

## 邀请处理

- 邀请链接形如 `/user/invitations?token=...`；页面据 `token` 展示接受入口，`?action=decline` 切换为拒绝。
- `GET /invitations` 只返回当前用户可处理的邀请，**不返回 Token**，所以列表条目只读展示，不提供「凭空接受」按钮。
- 成员页通过 `GET /ledgers/:id/invitations` 读取服务端完整的待处理邀请列表；创建响应中的一次性 Token 仍只在本次会话内保留，用于生成邀请链接。

## 迭代顺序

| 迭代 | 页面 | 后端前置 |
| --- | --- | --- |
| 一期一 | 账单页（只读）✅ | 无 |
| 一期二 | 记账抽屉 + 分类选择 ✅ | 无 |
| 一期三 | 账单详情 ✅ | 无；B4 降级不做撤销 |
| 一期四 | 分类管理 ✅ | 无 |
| 二期一 | 底部导航三项、账本页切换入口 | 无 |
| 二期二 | 我的账本、账本设置 | P2（偏好）可降级 |
| 二期三 | 成员与邀请、我的邀请 | 已实现 |
| 二期四 | 统计页 | P1/P6/P7/P8 全部 |

每迭代结束执行 `pnpm typecheck`、`pnpm test`、`pnpm lint`，并在浏览器验收该页面文档的「验收清单」。
