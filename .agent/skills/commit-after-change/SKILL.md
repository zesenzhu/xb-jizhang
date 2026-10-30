---
name: commit-after-change
description: Use when the user requests a commit after a completed change or the project policy enables automatic commit checkpoints for a logical change.
---

# 变更完成后提交规范

本技能采用业内常见的“逻辑变更一个原子提交”模式，不按文件保存次数提交。默认只执行 `git commit`，不自动 `git push`、打 Tag、合并分支或修改远程仓库。

## 触发范围

- 用户明确要求提交，或项目规则明确要求在逻辑变更完成后提交时使用。
- 只读分析、方案讨论、状态查询和用户明确要求“只修改不提交”时不触发。
- 提交权限只覆盖当前任务产生的文件；工作区中已有的用户改动不能顺带提交。

## 提交前流程

1. 执行 `git status --short --branch`，确认当前分支和工作区状态。
2. 检查 `git diff` 和未跟踪文件，识别无关改动、密钥、`.env`、构建产物和本地数据库文件。
3. 根据变更范围运行验证。默认优先执行：

   ```bash
   pnpm typecheck
   pnpm test
   pnpm lint
   ```

   纯文档或技能变更至少执行 `git diff --check`，并运行适用的文档/技能校验。

4. 只使用明确文件路径暂存本次变更，不使用未经检查的 `git add -A`。
5. 暂存后必须检查：

   ```bash
   git diff --cached --check
   git diff --cached --name-status
   git diff --cached --stat
   ```

6. 使用 `commit-convention` 生成中文 Conventional Commit，正文列出实际文件、关键变化和验证结果。

## 必须停止提交的情况

- 类型检查、测试或必要的 Lint 失败；
- 无法区分本次改动和用户既有改动；
- 暂存区包含密钥、环境配置、构建产物、本地数据或未授权文件；
- `git diff --cached --check` 失败；
- 提交钩子修改了工作区但修改内容未经重新检查；
- 需要 push、强制覆盖、改写历史或解决合并冲突，而用户没有明确授权。

遇到停止条件时，说明失败命令、文件范围和需要用户决定的事项，不要用 `--no-verify`、`--force` 或破坏性 Git 命令绕过检查。

## 提交粒度

- 一个可独立解释、验证和回滚的逻辑变更使用一个 commit。
- 测试规则、工程脚本和相关文档可以合并为一笔工程质量提交。
- 用户接口、数据库迁移、前端页面等互不依赖的工作拆成独立提交。

## 提交后交付

提交后执行 `git status --short --branch` 和 `git log -1 --oneline --decorate`，向用户报告：

- commit hash 和提交标题；
- 实际提交的文件和主要变化；
- 执行过的验证命令及结果；
- 是否存在未提交改动、未执行检查或未推送状态。
