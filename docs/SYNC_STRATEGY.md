# 同步策略规范（运行期）

> 生效日期：2026-03-07  
> 本文档定义“初始化完成后”的运行期同步行为。  
> 首次初始化策略请见 `SYNC_INITIALIZATION_STRATEGY.md`。

## 1. 目标与范围

1. 定义统一的三种同步策略：`local_win` / `remote_win` / `bidirectional`。
2. 定义运行期文件、目录、冲突、缺失确认等决策规则。
3. 约束实现边界，避免策略分叉和隐式高风险行为。
4. 提供可执行的验收标准，确保“按文档开发”可落地。

## 2. 术语定义

- `local`: Obsidian Vault 本地文件系统视图。
- `remote`: 远端存储文件系统视图。
- `tracked`: 已存在同步状态映射（`SyncEntry`）的路径。
- `tombstone`: 本地已删除、等待远端收敛的删除标记。
- `conflict_pending`: 路径处于冲突待人工合并状态。

## 3. 全局规则（优先级从高到低）

1. 冲突保护优先：`conflict_pending` 路径不自动执行 canonical path 的 upload/download。
2. tombstone 收敛优先：存在 `tombstone` 时优先执行删除收敛，不被普通增量覆盖。
3. 远端缺失双确认：remote missing 需连续两轮确认后才进入破坏性收敛。
4. 普通策略决策：按 `local_win` / `remote_win` / `bidirectional` 矩阵执行。

## 4. 策略定义

### 4.1 `local_win`

- 本地为权威源，远端镜像本地。
- 原则：除冲突副本外，不应把远端版本覆盖本地 canonical 文件。

### 4.2 `remote_win`

- 远端为权威源，本地镜像远端。
- 原则：除本地冲突备份外，不应把本地版本覆盖远端 canonical 文件。

### 4.3 `bidirectional`

- 双向同步，不自动选边覆盖冲突。
- 原则：冲突时产出副本并进入 `conflict_pending`，由用户手动合并后恢复。

## 5. 决策矩阵

| 场景                 | `local_win`                             | `remote_win`                            | `bidirectional`                                  |
| -------------------- | --------------------------------------- | --------------------------------------- | ------------------------------------------------ |
| local-only（文件）   | `upload`                                | `delete-local`                          | `upload`                                         |
| remote-only（文件）  | `delete-remote`                         | `download`                              | `download`                                       |
| both changed（文件） | `download remote copy` + `upload local` | `backup local copy` + `download remote` | `create conflict copy` + `mark conflict_pending` |
| local-only（目录）   | `create-remote-folder`                  | `delete-local`                          | `create-remote-folder`                           |
| remote-only（目录）  | `delete-remote`                         | `create-local-folder`                   | `create-local-folder`                            |
| tracked both missing | 清理映射（必要时补删）                  | 清理映射（必要时补删）                  | 清理映射（必要时补删）                           |

## 6. 特殊场景规则

### 6.1 远端缺失双确认

1. 对已 tracked 的远端缺失，首次仅累计 `remoteMissingCount`，不立即执行破坏性动作。
2. 连续两轮确认后才执行策略相关收敛（删除本地或重建远端）。

### 6.2 tombstone 收敛

1. `tombstone` 表示“本地已删除待远端删除”。
2. 非 `remote_win` 下，若远端仍存在对应对象，应优先计划 `delete-remote` 收敛。

### 6.3 `conflict_pending` 抑制

1. 同一路径在 `conflict_pending` 期间不可重复生成冲突任务。
2. 用户清除冲突标记并完成手工合并后，路径恢复普通增量同步。

## 7. 冲突处理规范（统一副本模型）

1. 冲突不再提供“直接选边覆盖”的策略入口。
2. 永远保留一份可继续编辑的 canonical 文件。
3. 将另一侧版本写入冲突副本，命名规范：

```text
<filename> (conflicted <source> YYYY-MM-DD HHmm).<ext>
```

4. `<source>` 仅允许：
    - `remote`
    - `local`

## 8. 实现约束（代码层）

1. 统一配置字段为 `syncStrategy`，枚举值仅：
    - `local_win`
    - `remote_win`
    - `bidirectional`
2. 不新增任何 `manual` 冲突策略代码路径。
3. 策略判断集中在 planner 层（`presence-policy` / `reconciler` / `remote-poller`），执行层只消费 job，不做策略分叉。
4. 任何可能造成批量删除的动作必须可在 preflight 中可见并可中止。

## 9. 测试与验收标准

### 9.1 单元测试最低覆盖

1. 三种策略下的 `local-only` / `remote-only`（文件+目录）。
2. `both changed` 的冲突副本产出与任务类型正确性。
3. 远端缺失双确认行为。
4. tombstone 收敛行为。
5. `conflict_pending` 抑制与解除。
6. 初始化完成后本地清空的行为：
    - 不走初始化特判；
    - 行为与当前 `syncStrategy` 一致。

### 9.2 集成验收

1. `planSync -> runPlannedSync` 行为符合决策矩阵。
2. `runAutoSync` 与 `pollRemoteSync` 不出现策略反向行为。
3. 在“初始化后本地清空”场景下，行为应严格遵循策略矩阵。

### 9.3 发布门槛

1. `pnpm run lint` 通过。
2. `pnpm run test` 通过。
3. `pnpm run build` 通过。
4. 手工验证至少覆盖一次“初始化后本地清空”场景。
