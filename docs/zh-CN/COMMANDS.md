# 命令

这份文档说明命令注册结构，以及每条命令的职责范围。

## 结构

命令注册代码位于 `src/commands/`，采用扁平布局：

- `index.ts`：组合入口；构建上下文、注册设置页，并注册全部命令
- `context.ts`：共享命令上下文与远端连接保护逻辑
- `command-*.ts`：每个文件只负责一个命令注册函数

这套布局是刻意保留的。好处是命令入口容易查找，也不会把所有用户动作塞进一个巨大的注册文件里。

## 共享保护逻辑

`createCommandContext()` 提供命令常用的公共保护：

- `requireScopeId()`：确保已经选择远端 scope
- `requireConnectedRemoteClient()`：确保认证和连接状态可用
- `runRemoteCommand()`：在统一连接检查和错误处理下执行命令回调

凡是会触达远端文件系统的命令，都应通过 `runRemoteCommand()` 执行，而不是自己重复实现保护逻辑。

## 命令目录

### 会话与 UI

- `drive-sync-connect`：连接当前远端 provider
- `drive-sync-login`：打开 provider 登录流程
- `drive-sync-logout`：登出并清除本地会话
- `drive-sync-review-conflicts`：打开冲突处理弹窗
- `drive-sync-show-status`：打开同步状态弹窗
- `drive-sync-open-settings`：打开 Obsidian 设置并聚焦到本插件

### 同步流程

- `drive-sync-pre-sync-check`：先估算同步工作量，再在确认弹窗中执行规划和同步
- `drive-sync-plan-sync`：只生成任务，不执行
- `drive-sync-poll-remote`：拉取远端增量并入队
- `drive-sync-run-planned-sync`：执行当前队列中的任务
- `drive-sync-auto-sync-now`：触发一次调度器驱动的自动同步
- `drive-sync-sync-vault`：把本地 vault 快照推到远端
- `drive-sync-restore-vault`：从远端恢复本地 vault 快照

### 维护类

- `drive-sync-validate-remote-ops`：对当前 scope 执行远端能力检查
- `drive-sync-pause-auto-sync`：暂停自动同步调度器
- `drive-sync-resume-auto-sync`：恢复自动同步调度器
- `drive-sync-rebuild-index`：根据本地与远端状态重建同步索引
- `drive-sync-export-diagnostics`：导出诊断包
- `drive-sync-reset-connection`：断开当前 provider 会话

## 添加新命令

1. 创建 `src/commands/command-<id>.ts`。
2. 导出一个注册函数，例如 `registerDriveSyncFooCommand(context)`。
3. 复用 `CommandContext` 提供的 scope、session 和错误处理辅助函数。
4. 在 `src/commands/index.ts` 中注册该命令。
5. 发布后保持命令 ID 稳定。
6. 成功和失败提示保持简洁。

## Review 清单

检查一条新命令时，至少确认：

- 它应该属于命令层，而不是 UI 或 runtime
- 它复用了共享保护逻辑，没有重复造轮子
- 它没有绕开 provider 或 runtime 抽象
- 它对用户显示的是安全文案
- 它的命令 ID 和作用足够清楚
