# 同步策略文档（现状 + 最新方案）

> 本文档合并了“当前实现梳理”和“策略重构方案”，作为统一参考。  
> 基线时间：2026-03-07。

## 1. 文档目标

1. 说明当前代码的实际同步行为（As-Is）。
2. 给出最新确认的目标策略（To-Be）：
    - `local_win`
    - `remote_win`
    - `bidirectional`
3. 明确“移除 `manual` 冲突策略，统一采用冲突副本 + 用户手动合并”的落地方案。
4. 提供可执行改造清单、迁移方案、测试与验收标准。

## 2. 当前实现（As-Is）

## 2.1 总体链路

当前是双向同步内核，分三层：

1. 触发层：`manual` + `interval` + `local watcher`
2. 计划层：本地增量计划 + 远端轮询 + 周期全量 reconcile
3. 执行层：优先级队列 + 有界并发 + 重试/阻塞 + 状态持久化

关键入口：

- `runtime/plugin-runtime.ts`
- `runtime/trigger-scheduler.ts`
- `runtime/sync-coordinator.ts`
- `sync/use-cases/sync-runner.ts`

## 2.2 触发与调度

- 三种触发：`manual` / `interval` / `local`
- single-flight：同一时刻只跑一轮，同步中触发会 pending 补跑
- 自动同步门禁：
    - `autoSyncEnabled = true`
    - 非 `autoSyncPaused`
    - 非 `authPaused`

## 2.3 Planner 行为

- 本地增量：`local-change-planner.ts`
    - rename/delete/create/modify -> 生成对应 job 与 entry 更新
- 远端轮询：`remote-poller.ts`
    - 优先 cursor/event
    - 否则 snapshot diff
    - 远端缺失采用“两轮确认”后再收敛
- 全量对账：`reconciler.ts`
    - 15 分钟节流（或 force）
    - 本地变化依据 `mtime/size`
    - 远端变化依据 `revisionId`

## 2.4 当前冲突策略

当前 `presence-policy.ts` 支持：

- `local-wins`（默认）
- `remote-wins`
- `manual`

其中 `manual` 会打 `entry.conflict` 并写延后占位任务，不是最终目标策略。

## 2.5 执行/重试/恢复

- 队列排序：`priority desc` -> `nextRunAt asc` -> `id asc`
- 并发：全局默认 2，同路径串行
- 最大重试：5，按错误类型退避
- 状态：`pending/processing/blocked`
- 存储：IndexedDB Dexie（entries/jobs/meta/logs）

## 2.6 当前已知边界

1. cursor 轮询依赖已有 `remoteEventCursor`，首次通常走 snapshot。
2. 背景 reconcile 在“完全无任务”时节流时间戳不前移。
3. 本地触发是 watcher + scheduler 双 debounce，默认存在额外延迟。

## 3. 最新目标策略（To-Be）

## 3.1 策略枚举

新增统一配置：

```ts
type SyncStrategy = "local_win" | "remote_win" | "bidirectional";
```

移除 `manual` 作为可选策略。

## 3.2 三种策略定义

### `local_win`

本地权威，远端镜像本地：

- local-only -> 上传/建目录
- remote-only -> 删除远端
- both changed -> 保留本地为主，远端版本生成副本供用户参考

### `remote_win`

远端权威，本地镜像远端：

- remote-only -> 下载/建目录
- local-only -> 删除本地
- both changed -> 保留远端为主，先备份本地副本再覆盖

### `bidirectional`

双向同步，冲突不自动选边：

- 单边变化正常同步
- both changed -> 创建冲突副本并标记 `conflict_pending`
- `conflict_pending` 下 canonical path 不再自动 upload/download，等待用户手动合并

## 3.3 冲突统一原则（去 manual）

冲突处理统一为“副本策略”：

1. 保留一份可继续编辑的原文件。
2. 将另一侧版本落地为冲突副本。
3. 用户手动合并后，按普通变更继续同步。

建议副本命名：

```text
<filename> (conflicted <source> YYYY-MM-DD HHmm).<ext>
```

`<source>`：

- `remote`
- `local`

## 3.4 目标决策矩阵

| 场景                 | `local_win`                             | `remote_win`                            | `bidirectional`                                  |
| -------------------- | --------------------------------------- | --------------------------------------- | ------------------------------------------------ |
| local-only（文件）   | `upload`                                | `delete-local`                          | `upload`                                         |
| remote-only（文件）  | `delete-remote`                         | `download`                              | `download`                                       |
| both changed（文件） | `download remote copy` + `upload local` | `backup local copy` + `download remote` | `create conflict copy` + `mark conflict_pending` |
| local-only（目录）   | `create-remote-folder`                  | `delete-local`                          | `create-remote-folder`                           |
| remote-only（目录）  | `delete-remote`                         | `create-local-folder`                   | `create-local-folder`                            |
| tracked both missing | 清理映射                                | 清理映射                                | 清理映射                                         |

统一补充规则：

1. 继续保留两轮 remote missing 确认。
2. 继续保留 tombstone 收敛语义。
3. `bidirectional` 冲突路径进入 `conflict_pending` 后，不自动重复生成同一路径冲突任务。

## 4. 代码改造范围

## 4.1 配置与模型

- `settings.ts`
    - 新增 `syncStrategy`
    - 废弃 `conflictStrategy`

- `main.ts`
    - 增加迁移逻辑与兼容读取

## 4.2 Planner 决策层

- `sync/planner/presence-policy.ts`
    - 参数从 `conflictStrategy` 切到 `syncStrategy`
    - 删除 `manual` 分支
    - 引入副本冲突分支与 `conflict_pending` 行为

- `sync/planner/reconciler.ts`
- `sync/planner/remote-poller.ts`
    - 统一接入新决策接口

## 4.3 Runner/Engine 参数透传

- `sync/use-cases/sync-runner.ts`
- `sync/engine/sync-engine.ts`
- `runtime/sync-coordinator.ts`
- `runtime/use-cases/sync-workflows.ts`

调整点：

- `conflictStrategy` 参数统一替换为 `syncStrategy`
- 执行引擎仍保持 job 消费边界，不引入策略分叉

## 4.4 UI 与命令

- `settings.ts`
    - 下拉改为三策略
- `ui/status-modal.ts`
    - 展示当前策略/权威方向
- `ui/conflict-modal.ts`
    - 去掉 `Keep local/Use remote` 决策按钮
    - 仅展示冲突与副本信息，保留“清除冲突标记”
- `runtime/use-cases/diagnostics.ts`
    - 输出 `syncStrategy`

## 5. 迁移与安全保护

## 5.1 迁移原则

不做静默猜测映射：

- 不直接 `local-wins -> local_win`
- 不直接 `remote-wins -> remote_win`
- 不直接 `manual -> bidirectional`

原因：旧字段表达的是“冲突偏好”，不是“同步方向权威”。

## 5.2 推荐迁移流程

1. 升级后若发现旧字段且无新字段：
    - 默认写入 `syncStrategy = bidirectional`
    - 置 `strategySelectionRequired = true`
2. 用户确认策略前：
    - 自动同步暂停
    - 允许手动同步并显示风险提示

## 5.3 策略切换保护

1. 强制 preflight（显示 upload/download/delete 数量）。
2. 删除量超阈值时二次确认。
3. 切换后首轮建议仅手动执行。

## 6. 实施阶段

### Phase A：配置与迁移

1. 增加 `syncStrategy` 模型与 UI
2. 增加旧配置迁移逻辑
3. 诊断字段切换

### Phase B：Planner 决策重构

1. `presence-policy` 改为三策略决策
2. 删除 `manual` 语义
3. 引入 `conflict_pending` 行为

### Phase C：UI/命令与冲突交互

1. 冲突页改成“副本 + 提示手工合并”
2. 状态页与提示文案统一新术语
3. preflight 接入策略切换风险提示

### Phase D：清理与文档

1. 移除旧 `conflictStrategy` 写路径
2. 更新架构/规格文档与验收清单
3. 全量回归

## 7. 测试计划

## 7.1 单元测试

重点覆盖：

- `tests/sync/presence-policy.test.ts`
- `tests/sync/reconciler.test.ts`
- `tests/sync/local-change-planner.test.ts`

每种策略至少覆盖：

1. local-only file/folder
2. remote-only file/folder
3. both changed
4. tombstone + missing 两轮确认
5. `bidirectional` 的 `conflict_pending` 抑制/解锁
6. `remote_win` 本地副本备份逻辑

## 7.2 集成回归

覆盖链路：

1. `planSync -> runPlannedSync`
2. `runAutoSync`
3. `pollRemoteSync`

断言重点：

- job 分布符合策略矩阵
- 不出现反向行为（例如 `local_win` 出现 download）

## 7.3 手工验收

1. 升级后策略确认流程是否生效
2. 策略切换是否强制 preflight
3. 冲突时是否只创建副本，不再出现 manual 按钮
4. 用户合并后是否可恢复正常同步收敛

## 8. 最终验收标准

1. 设置中仅有三种策略：`local_win` / `remote_win` / `bidirectional`
2. 配置/UI/执行链路中不再存在 `manual` 冲突策略入口
3. 冲突统一为“创建副本 + 用户手动合并”
4. 三策略输出任务与矩阵一致
5. 迁移过程不会静默触发高风险删除
6. `pnpm run lint`、`pnpm run test`、`pnpm run build` 全通过
