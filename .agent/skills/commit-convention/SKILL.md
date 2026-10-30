---
name: commit-convention
description: Use when preparing a Git commit for changes in this repository, especially when the diff spans backend, frontend, Docker, database, or documentation files.
---

# 记账项目提交规范

提交标题使用：

```text
<type>(<scope>): <简洁的中文标题>
```
可用类型：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`perf`、`style`。

标题后保留空行，并根据实际 diff 写出具体正文。正文至少说明：

- 修改了哪些文件或模块；
- 业务规则或部署行为如何变化；
- 新增了哪些验证，或仍有哪些验证未执行。

不要在提交信息中描述没有发生的修改，也不要把多个无关主题混在一个提交中。提交前确认工作区中没有误加入的环境文件、密钥、构建产物或数据库本地数据。

示例：

```text
feat(transaction): 增加账单幂等创建

- 后端 transaction 模块：使用 clientRequestId 防止离线重试重复创建账单。
- 后端 Prisma Schema：增加账本范围唯一约束并补充查询索引。
- 验证：完成后端类型检查和重复请求测试。
```
