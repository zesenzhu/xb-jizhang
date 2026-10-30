---
name: commenting-convention
description: Use when adding or refactoring NestJS, Prisma, Next.js, React, Zustand, Axios, or synchronization code in this repository and the design intent is not obvious from the code.
---

# 记账项目注释规范

- 注释解释 Why，不复述代码正在做什么。重点说明权限边界、金额精度、幂等、并发、离线同步或缓存一致性等容易被误改的原因。
- DTO、公共类型、复杂 Service 方法、拦截器、Middleware、Service Worker 和同步队列应有简洁的中文 JSDoc 或行前说明。
- 事件驱动代码需要说明事件来源、载荷契约、处理顺序和失败行为。
- 不要求为简单赋值、明显的 JSX 结构或标准框架样板增加注释。
- 代码注释、JSDoc、Swagger 描述和用户可见文案使用中文；第三方 API 名称、协议名和字段名可保留英文。
- 不留下 `TODO`、`待实现` 或无法运行的 placeholder。确实未纳入当前范围的能力应写入需求或技术文档，而不是伪造实现。
