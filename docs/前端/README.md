---
title: 一期前端设计索引
type: index
status: draft
version: 0.2
owner: 小宝
updatedAt: 2026-11-04
---

# 一期前端设计索引

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
| 账单页 | `/user` | [账单页.md](./账单页.md) | draft |
| 记账抽屉 | `/user` 浮层 | [记账抽屉.md](./记账抽屉.md) | draft |
| 分类选择 | 记账抽屉二级浮层 | [分类选择.md](./分类选择.md) | draft |
| 账单详情 | `/user` 浮层 | [账单详情.md](./账单详情.md) | draft |

尚未设计（后续迭代按需新增文件）：账本切换面板、筛选面板、个人中心改版。

## 后端能力现状

对 `backend/src`、`prisma/schema.prisma` 与 `docs/api/` 的逐项比对结论。**后端正在按 API 文档补实现，本表需在每次后端提交后复核；缺口修复后同步删除对应页面文档里的降级说明。**

### 已具备（前端可直接用）

| 能力 | 接口 | 证据 |
| --- | --- | --- |
| 账单创建（账户可选、幂等、事务） | `POST /ledgers/:id/transactions` | `create-transaction.dto.ts` 的 `accountId` 为 `@IsOptional` |
| 账单编辑 + 版本冲突 | `PATCH /ledgers/:id/transactions/:tid` | `transaction.service.ts` 的 `update`，`40922` |
| 账单软删除 + 角色边界 | `DELETE /ledgers/:id/transactions/:tid` | `OWNER` 全部、`EDITOR` 仅自己创建 |
| 无账户账单参与列表与统计 | 列表 `where` 与统计 `where` 均含 `accountId: null` | `transaction.service.ts`、`statistics.service.ts` |
| **收支概览聚合** | `GET /ledgers/:id/statistics/overview` | 已实现，返回 `totalIncomeCents` / `totalExpenseCents` / `netCents` / `transactionCount` |

概览接口改变了前端的统计实现：不再需要前端累加分页，直接按同一组筛选条件请求聚合结果即可。`docs/api/统计接口.md` 明确「服务端聚合结果为唯一口径，前端不重复计算」。

### 仍缺（阻塞对应页面）

| # | 缺口 | 证据（当前 HEAD） | 阻塞页面 |
| --- | --- | --- | --- |
| B1 | 分类无层级字段 | `schema.prisma` Category 无 `parentId`；`账户与分类接口.md` 未提层级 | 分类选择 |
| B2 | 默认分类仅 4 条 | `category.constants.ts` 实测 4 条；需求 9.2 要 16 个一级 + 二级 | 分类选择 |
| B3 | 账本无时区 | Ledger 模型无 `timezone`；`账本与成员接口.md` 摘要字段无该字段 | 账单页（日期分组） |
| B4 | 无撤销删除接口 | 有 `DELETE`，controller 无 `restore` 路由 | 账单详情 |
| B5 | 无记账人筛选 | `QueryTransactionsDto` 无 `createdById` | 账单页（筛选） |
| B6 | 关键词不匹配分类名 | `keywordCondition` 只覆盖 `title` / `note` | 账单页（搜索） |

### 已知偏差（可降级）

| # | 问题 | 证据 | 前端处理 |
| --- | --- | --- | --- |
| D2 | `note` 上限 2000 | `create` / `update` DTO 均为 `@Length(1,2000)` | 需求要求 200，前端自行限制 |
| D3 | 详情无分类图标、无成员昵称 | `transactionSelect` 只取 `category{id,type,name}`，`createdById` 为裸 ID | 名称首字 + 成员表映射 |
| D4 | 统计筛选少于列表筛选 | 统计支持 `from/to/type/categoryId/accountId`；列表另有 `keyword`、`payerId` | 见下方「概览与列表筛选不一致」 |

### 概览与列表筛选不一致（需后端补齐）

需求 6.1 要求「概览金额、每日合计和账单列表必须使用同一组已生效筛选条件」，但两个接口的参数集不同：

| 参数 | 列表 | 统计 |
| --- | --- | --- |
| `from` / `to` / `type` / `categoryId` / `accountId` | ✅ | ✅ |
| `keyword` | ✅ | ❌ |
| `payerId` | ✅ | ❌ |
| `createdById` | ❌ | ❌ |

后果：用户输入关键词后，列表缩小但概览不变，违反需求 6.1。一期前端处理：**有关键词或付款人筛选时，概览区显示「概览未跟随该条件」提示**，不静默展示不一致的数字。后端补齐参数后移除该提示。

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
| `AmountKeypad` 内嵌 `pb-safe` | `mobile/AmountKeypad.tsx` | 放进抽屉会与抽屉 safe-area 叠加 |

### 层级

| 层 | z-index |
| --- | --- |
| 页面内容 | 0 |
| FAB | 30 |
| 底栏 `MobileBottomNav` | 40 |
| 抽屉 / 详情面板 | 50 |
| 分类选择（二级浮层） | 60 |
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

`/user` 由当前演示页改造为**账单页**，不新建 `/user/ledger/[id]/transactions`。理由：需求 5.1 规定账单页是进入应用后的主页面；单页账本视图（账本名 + 月份 + 分组）符合参考设计；多一层路径会让「打开即记账」变慢，且同一份账单会有两个 URL 入口。

现有 `AmountKeypad` 从首页卡片移入记账抽屉，成为唯一记账入口。`/user/ledger`、`/user/ledger/new`、`/user/profile` 保持不变。

## 迭代顺序

| 迭代 | 页面 | 后端前置 |
| --- | --- | --- |
| 一 | 账单页（只读） | 无；概览已可用 `statistics/overview` |
| 二 | 记账抽屉 + 分类选择 | B1、B2 |
| 三 | 账单详情 | B5、B6；B4 视产品结论 |
| 四 | 时区统一、暗色补齐、死代码清理 | B3 |

每迭代结束执行 `pnpm typecheck`、`pnpm test`、`pnpm lint`，并在浏览器验收该页面文档的「验收清单」。
