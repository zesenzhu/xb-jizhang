---
name: typescript-type-convention
description: Use when defining API contracts, DTOs, Prisma mappings, React props, Zustand state, event payloads, or synchronization data in this repository.
---

# 记账项目 TypeScript 类型规范

- `tsconfig` strict 模式下开发；公共函数、Service 方法、API 请求和响应都要有明确输入输出类型。
- 优先使用 `interface`、联合类型、泛型和类型守卫；外部 JSON、Socket 事件和 IndexedDB 数据先使用 `unknown`，验证后再收窄。
- 禁止为了快速通过编译而把 API 响应、事件载荷、表单值或 Zustand 状态声明为 `any`。第三方库确实无法建模时，局部豁免必须说明原因并尽快转换为具体类型。
- 不把 Prisma Model 直接当作所有 HTTP 响应类型。根据接口需要映射字段，避免密码、内部审计字段和无关关系被输出。
- 金额、账单类型、成员角色、同步状态和错误码使用联合类型或枚举，避免散落的字符串字面量。
- 客户端同步操作应定义稳定的载荷类型，至少区分操作 ID、账本 ID、实体 ID、操作类型、请求体、重试次数和冲突信息。
- 类型断言只能在运行时校验已经证明结构成立时使用，不能用 `as` 掩盖不确定数据。
