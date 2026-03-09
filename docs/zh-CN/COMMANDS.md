# Commands

本文档说明命令是如何组织的，以及每条命令的职责。

## 结构

命令注册位于 `src/commands/`，采用平铺的一命令一文件布局：

- `index.ts`：组合根。构建上下文、注册设置页，并直接注册所有命令。
- `context.ts`：共享命令上下文与远端连接保护逻辑。
- `command-*.ts`：每个文件导出一个命令注册函数（`registerDriveSync*Command`）。

## 共享保护逻辑

`createCommandContext()` 提供：

- `requireScopeId()`：确保已选择远端 scope。
- `requireConnectedRemoteClient()`：确保认证/会话/连接有效。
- `runRemoteCommand()`：为命令回调统一包裹连接检查。

所有会触达远端文件系统的命令，都应运行在 `runRemoteCommand()` 内部。

## 命令目录

### 会话与 UI

- `drive-sync-connect`：连接远端 provider。
- `drive-sync-login`：打开 provider 登录弹窗。
- `drive-sync-logout`：登出并清空已存会话。
- `drive-sync-review-conflicts`：打开冲突审查弹窗。
- `drive-sync-show-status`：打开同步状态弹窗。
- `drive-sync-open-settings`：打开 Obsidian 设置并聚焦到本插件设置页。

### 同步流程

- `drive-sync-pre-sync-check`：先估算，再从弹窗中执行 plan + run。
- `drive-sync-plan-sync`：仅规划作业。
- `drive-sync-poll-remote`：轮询远端 delta 并入队作业。
- `drive-sync-run-planned-sync`：执行已入队作业。
- `drive-sync-auto-sync-now`：由调度器触发一次自动同步。
- `drive-sync-sync-vault`：将本地 vault 快照上传到远端。
- `drive-sync-restore-vault`：从远端恢复本地 vault 快照。

### 维护类

- `drive-sync-validate-remote-ops`：执行远端创建/列出/读取/删除能力检查。
- `drive-sync-pause-auto-sync`：暂停自动同步调度器。
- `drive-sync-resume-auto-sync`：恢复自动同步调度器。
- `drive-sync-rebuild-index`：根据本地/远端状态重建同步索引。
- `drive-sync-export-diagnostics`：导出运行时诊断包。
- `drive-sync-reset-connection`：断开当前 provider 连接。

## 添加新命令

1. 在 `src/commands/` 下新建 `command-<id>.ts`。
2. 导出一个注册函数，例如 `registerDriveSyncFooCommand(context)`。
3. 复用 `CommandContext` 辅助函数，不要重复实现 scope / session 检查。
4. 在 `src/commands/index.ts` 中直接注册新命令。
5. 发布后保持命令 ID 稳定，并使用简洁的 `Notice` 反馈。
