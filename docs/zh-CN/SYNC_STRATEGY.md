# 运行时同步策略规范

> 生效日期：2026-03-07
> 本文档定义初始化完成后的运行时行为。
> 首次初始化策略请参见 `SYNC_INITIALIZATION_STRATEGY.md`。

## 1. 目标与范围

1. 定义三种统一策略：`local_win` / `remote_win` / `bidirectional`。
2. 定义运行时对文件、文件夹、冲突和缺失确认的决策规则。
3. 约束实现边界，避免策略分叉和隐蔽的高风险行为。
4. 提供可执行的验收标准，确保实现符合文档。

## 2. 术语

- `local`：Obsidian vault 的本地文件系统视图。
- `remote`：远端存储的文件系统视图。
- `tracked`：已经存在同步状态映射（`SyncEntry`）的路径。
- `tombstone`：等待与远端收敛的本地删除标记。
- `conflict_pending`：等待用户手动合并的冲突挂起状态。

## 3. 全局规则（优先级从高到低）

1. 冲突保护优先：处于 `conflict_pending` 的路径不得自动执行规范化 upload/download。
2. 墓碑收敛优先：存在 `tombstone` 时，应优先处理删除收敛，而不是普通增量更新。
3. 远端缺失双重确认：远端缺失必须连续两轮确认后，才能执行破坏性收敛。
4. 常规策略决策：按 `local_win` / `remote_win` / `bidirectional` 矩阵执行。

## 4. 策略定义

### 4.1 `local_win`

- 本地是权威来源；远端镜像本地。
- 原则：除冲突副本外，远端内容不得覆盖本地的规范文件。

### 4.2 `remote_win`

- 远端是权威来源；本地镜像远端。
- 原则：除本地冲突备份外，本地内容不得覆盖远端的规范文件。

### 4.3 `bidirectional`

- 双向同步；发生冲突时不自动选择某一侧。
- 原则：冲突时生成冲突副本并进入 `conflict_pending`，待手动合并后再恢复。

## 5. 决策矩阵

| 场景                 | `local_win`                         | `remote_win`                     | `bidirectional`                        |
| -------------------- | ----------------------------------- | -------------------------------- | -------------------------------------- |
| 仅本地存在（文件）   | `upload`                            | `delete-local`                   | `upload`                               |
| 仅远端存在（文件）   | `delete-remote`                     | `download`                       | `download`                             |
| 双端都变化（文件）   | `download` 远端副本 + `upload` 本地 | 备份本地副本 + `download` 远端   | 创建冲突副本 + 标记 `conflict_pending` |
| 仅本地存在（文件夹） | `create-remote-folder`              | `delete-local`                   | `create-remote-folder`                 |
| 仅远端存在（文件夹） | `delete-remote`                     | `create-local-folder`            | `create-local-folder`                  |
| 双端都缺失且已跟踪   | 清理映射（并执行所需的清理删除）    | 清理映射（并执行所需的清理删除） | 清理映射（并执行所需的清理删除）       |

## 6. 特殊规则

### 6.1 远端缺失双重确认

1. 对已跟踪且远端缺失的路径，第一轮仅增加 `remoteMissingCount`，不执行破坏性动作。
2. 只有在连续两轮确认后，才允许执行策略驱动的收敛（删除本地或重建远端）。

### 6.2 墓碑收敛

1. `tombstone` 表示“本地已删除，等待远端删除”。
2. 在非 `remote_win` 下，如果远端对象仍存在，应优先规划 `delete-remote` 收敛。

### 6.3 `conflict_pending` 抑制

1. 当 `conflict_pending` 仍然生效时，不得为同一路径重复生成冲突作业。
2. 用户清理冲突标记并完成手工合并后，该路径恢复到普通增量同步流程。

## 7. 冲突处理规范（统一副本模型）

1. 冲突处理不再暴露“直接按某一侧覆盖”的策略路径。
2. 始终保留一个可编辑的规范文件。
3. 将对侧版本写入一个冲突副本，命名格式如下：

```text
<filename> (conflicted <source> YYYY-MM-DD HHmm).<ext>
```

4. `<source>` 只能取：
    - `remote`
    - `local`

## 8. 实现约束（代码级）

1. 使用统一配置字段 `syncStrategy`，枚举值仅允许：
    - `local_win`
    - `remote_win`
    - `bidirectional`
2. 不得新增任何 `manual` 冲突策略分支。
3. 将策略分支集中在 planner 层（`presence-policy` / `reconciler` / `remote-poller`）；执行层只消费作业，不得再按策略分叉。
4. 任何可能造成批量删除的动作，必须在 preflight 中可见且可中止。

## 9. 测试与验收标准

### 9.1 最低单元测试覆盖

1. 三种策略下 `local-only` / `remote-only` 行为（文件 + 文件夹）。
2. `both changed` 时冲突副本生成与作业类型正确。
3. 远端缺失双重确认行为。
4. 墓碑收敛行为。
5. `conflict_pending` 的抑制与解除。
6. 初始化后清空本地的行为：
    - 不得再走初始化硬规则捷径；
    - 必须严格遵循当前 `syncStrategy`。

### 9.2 集成验收

1. `planSync -> runPlannedSync` 的行为与决策矩阵一致。
2. `runAutoSync` 与 `pollRemoteSync` 不得出现策略反转。
3. 在“初始化完成后本地被清空”的场景下，行为必须严格遵循矩阵。

### 9.3 发布门槛

1. `pnpm run lint` 通过。
2. `pnpm run test` 通过。
3. `pnpm run build` 通过。
4. 手工验证至少覆盖一个“初始化完成后本地被清空”的场景。
