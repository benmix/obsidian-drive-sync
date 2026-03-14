# 运行时同步策略规范

> 生效日期：2026-03-07
> 本文只约束初始化完成后的常规同步行为。首次同步规则见 [`SYNC_INITIALIZATION_STRATEGY.md`](./SYNC_INITIALIZATION_STRATEGY.md)。

## 1. 目的

这份文档定义常规运行时同步的决策规则，主要为了明确三件事：

- 每种同步策略到底意味着什么
- 哪些特殊保护规则优先于普通决策矩阵
- 哪些地方允许做实现分支

## 2. 术语

- `local`：Obsidian vault 的本地视图
- `remote`：远端文件系统视图
- `tracked`：已经有同步状态映射的路径
- `tombstone`：等待与远端收敛的本地删除标记
- `conflict_pending`：等待人工处理冲突的路径

## 3. 全局规则

以下规则按优先级从高到低执行：

1. 冲突保护优先。处于 `conflict_pending` 的路径不得自动进入常规上传或下载。
2. 墓碑收敛优先于普通增量更新。
3. 远端缺失必须连续确认两次，才允许做破坏性收敛。
4. 如果没有命中特殊规则，则由当前 `syncStrategy` 决定行为。

## 4. 策略定义

### 4.1 `local_win`

本地为事实来源，远端镜像本地。

约束：

- 除冲突副本外，远端内容不得覆盖本地 canonical 文件

### 4.2 `remote_win`

远端为事实来源，本地镜像远端。

约束：

- 除本地冲突备份外，本地内容不得覆盖远端 canonical 文件

### 4.3 `bidirectional`

本地和远端在冲突发生前都可视为权威来源。

约束：

- 当两边都发生变化时，系统不会自动选边，而是生成冲突副本并进入 `conflict_pending`

## 5. 决策矩阵

| 场景                 | `local_win`                             | `remote_win`                            | `bidirectional`                                  |
| -------------------- | --------------------------------------- | --------------------------------------- | ------------------------------------------------ |
| 仅本地存在的文件     | `upload`                                | `delete-local`                          | `upload`                                         |
| 仅远端存在的文件     | `delete-remote`                         | `download`                              | `download`                                       |
| 两边都改过的文件     | `download remote copy` + `upload local` | `backup local copy` + `download remote` | `create conflict copy` + `mark conflict_pending` |
| 仅本地存在的文件夹   | `create-remote-folder`                  | `delete-local`                          | `create-remote-folder`                           |
| 仅远端存在的文件夹   | `delete-remote`                         | `create-local-folder`                   | `create-local-folder`                            |
| 已跟踪但两边都不存在 | 清理映射及残留状态                      | 清理映射及残留状态                      | 清理映射及残留状态                               |

## 6. 特殊规则

### 6.1 远端缺失双重确认

- 对于已跟踪路径，第一次观察到远端缺失时，只增加 `remoteMissingCount`。
- 只有第二次连续确认后，才允许执行 delete-local 或 recreate-remote 之类的破坏性收敛。

### 6.2 墓碑收敛

- tombstone 表示本地已经删除，而远端仍需跟进收敛。
- 在 `remote_win` 之外的策略下，planner 应优先规划 `delete-remote`，而不是继续普通增量同步。

### 6.3 `conflict_pending` 抑制

- 当路径已处于 `conflict_pending` 时，不要为同一路径重复生成冲突任务。
- 用户处理完成并清除标记后，该路径才恢复正常增量同步。

## 7. 冲突副本模型

冲突处理统一采用一套模型：

1. 保留一个 canonical 可编辑文件
2. 把另一侧版本写入冲突副本
3. 将路径标记为 `conflict_pending`
4. 只有人工处理完成后才恢复常规同步

冲突副本命名：

```text
<filename> (conflicted <source> YYYY-MM-DD HHmm).<ext>
```

允许的 `<source>` 值：

- `local`
- `remote`

## 8. 实现约束

- `syncStrategy` 只能使用 `local_win`、`remote_win`、`bidirectional`。
- 不要重新引入单独的 `manual` 冲突策略路径。
- 策略分支必须放在 planner 级逻辑里，而不是执行层里。
- 执行层负责消费任务，不负责再次判定策略。
- 任何可能导致大规模删除的操作都必须在 preflight 中可见且可取消。

## 9. 验证要求

### 9.1 最低单元覆盖

- 三种策略下本地独有和远端独有的行为
- 双边都修改时的任务类型和冲突副本行为
- 远端缺失双重确认行为
- 墓碑收敛行为
- `conflict_pending` 的抑制与释放
- 初始化完成后本地清空场景不应回退到初始化硬规则

### 9.2 集成覆盖

- `planSync` 与 `runPlannedSync` 的结果符合决策矩阵
- `runAutoSync` 和 `pollRemoteSync` 不得出现策略语义反转
- 初始化后的本地清空场景应严格遵循运行时策略，而不是初始化规则

### 9.3 发布门槛

- `pnpm run lint` 通过
- `pnpm run test` 通过
- `pnpm run build` 通过
- 人工验证至少覆盖一次初始化完成后本地被清空的场景
