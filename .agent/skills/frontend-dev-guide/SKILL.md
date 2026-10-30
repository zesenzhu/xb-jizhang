---
name: frontend-dev-guide
description: Use when adding or changing Next.js App Router pages, Axios requests, Zustand stores, PWA behavior, offline synchronization, or shared ledger interfaces in this repository.
---

# 记账项目前端开发技能

## Next.js 与页面边界

- 默认使用 App Router 和 Server Component；只有需要浏览器 API、事件、Zustand 或 IndexedDB 的组件才使用 `use client`。
- 使用 `useSearchParams()` 的组件必须由页面层的 `Suspense` 包裹。
- API、表单、组件 Props 和账单数据必须在 `frontend/src/types/` 或相邻模块定义明确类型。
- 页面按记账工作流组织：账本切换、首页概览、账单、账户、分类、统计、预算和成员管理。不要复制旧项目的 `/admin`、`/user` 双端业务模型。

## 请求与认证

- Axios 实例统一配置 `withCredentials: true`，使用同源 `/api` 优先，避免部署时跨域 Cookie 问题。
- 401 只允许一个刷新请求；其余请求进入队列。刷新成功后重放，失败后清理会话并跳转登录页。
- Access Token 和 Refresh Token 不持久化到 localStorage。Zustand 只保存用户摘要、当前账本 ID、界面偏好和同步状态。
- API 错误必须转换为可展示的明确文案；保存失败时不能清空用户正在填写的表单。

## Zustand 与离线 PWA

- Zustand 保存客户端状态，不保存完整账单主数据，也不替代服务端查询缓存。
- 离线账单进入 IndexedDB 队列，包含客户端幂等 ID、操作类型、账本 ID、请求体和重试状态。
- Service Worker 只缓存静态资源和允许缓存的公开内容；用户账单接口不能被无条件缓存。
- 恢复联网后按顺序同步，服务端返回冲突时保留本地输入并给用户可理解的处理入口。
- 网络状态、同步中、同步成功、同步失败和冲突状态必须在界面上有明确反馈。

## 交互与性能

- 移动端优先保证“快速记一笔”：金额、类型、分类和账户应少步骤完成。
- 账单列表优先使用分页和服务端筛选；只有数据量确实需要时才引入虚拟列表。
- 复用现有 Tailwind 和 Lucide 依赖，新增 UI 库前先确认组件边界和包体积影响。
- 如果引入基于 Base UI 的下拉组件，不使用旧 Radix 的 `asChild` 用法。

## 验证重点

修改后至少检查刷新页面状态、401 并发请求、窄屏布局、离线新增、重复同步、跨账本切换和空数据状态。
