# Obsidian 云盘同步 架构设计

## 1. 文档目标

本文档描述与当前代码实现相对应的架构，重点回答以下问题：

- 模块如何分层，以及边界如何定义。
- 同步流程如何从 UI / 命令进入并最终执行。
- Provider 与 Sync Kernel 如何解耦。
- 未来扩展（新 provider / provider 专用行为）应当在何处实现。

这是一份面向实现的工程文档，不重复产品需求细节。产品范围与功能规格请参见 `docs/SPECS.md`。

## 2. 架构总览

```text
UI / Commands
      |
      v
Plugin Facade (main.ts)
      |
      v
Runtime Orchestration (runtime/*)
      |                        \
      |                         \-- Session / Policy / Scheduling
      v
Sync Kernel (sync/*)  <---->  Filesystem Contracts (contracts/filesystem/*)
      ^
      |
Provider Abstraction (contracts/provider/* + provider/registry)
      |
      +-- Local Provider impl (provider/providers/obsidian/*)
      +-- Remote Provider impl (provider/providers/proton-drive/*)

Data Layer
  - Plugin settings: Obsidian plugin data (data/plugin-data.ts)
  - Sync state/index/jobs/logs: IndexedDB Dexie (data/sync-db.ts + sync/state/*)
```

## 3. 分层与职责

### 3.1 Filesystem Contracts（共享基础契约）

- 目录：
    - `src/contracts/filesystem/*`
    - `src/filesystem/path.ts`
- 职责：
    - 定义 `LocalFileSystem`、`RemoteFileSystem`、`LocalChange` 等共享 IO 契约。
    - 提供路径工具（`path.ts`）作为跨层可复用的基础原语。
- 约束：
    - 只包含类型与基础工具，不包含业务流程逻辑。

### 3.2 Provider 层（外部系统集成）

- 目录：`src/provider/*`
- 职责：
    - 提供统一的本地/远端抽象（`LocalProvider` / `RemoteProvider`）。
    - 通过注册表管理当前启用的 provider。
    - 隔离 SDK 与平台 API 差异。
- 关键点：
    - `default-registry.ts` 只注册当前活动 ID 所需的 provider。
    - 远端 provider 直接返回具体的 `RemoteFileSystem` adapter。
    - 当前没有启用共享的 provider 侧策略或中间件层。

### 3.3 Sync Kernel

- 目录：`src/sync/*`
- 职责：
    - `planner/*`：变更检测与对账规划（local / remote / reconcile）。
    - `engine/*`：队列执行、重试与状态推进。
    - `state/*`：同步状态持久化抽象。
    - `use-cases/sync-runner.ts`：单次同步周期入口。
- 设计原则：
    - 保持 provider 无关；仅依赖 `src/contracts/*` 下的共享契约。

### 3.4 Runtime 层（编排）

- 目录：`src/runtime/*`
- 职责：
    - `plugin-state.ts`：插件设置 / provider 状态门面（加载 / 迁移 / 保存设置，维护活动 provider 注册表与认证 / 会话字段）。
    - `plugin-runtime.ts`：生命周期编排中心。
    - `session-manager.ts`：会话恢复 / 刷新与 auth-pause 控制。
    - `trigger-scheduler.ts`：定时轮询 + 本地变更防抖 + single-flight。
    - `sync-coordinator.ts`：组合本地 / 远端文件系统并调用 `SyncRunner`。
    - `network-policy.ts`：网络门禁与失败冷却（可通过开关启用）。

### 3.5 Plugin Facade / UI / Commands（外层交互层）

- `main.ts`
    - 插件入口门面，负责生命周期接线，并把状态 / 运行时操作委托出去。
- `ui/*`
    - 仅依赖插件 API 与 provider 抽象；不得依赖具体 provider 实现。
- `commands/*`
    - 每条命令一个文件，位于 `src/commands/command-*.ts`；`commands/index.ts` 负责组合上下文、注册设置页，并注册每条命令。

## 4. 核心抽象

### 4.1 `ObsidianDriveSyncPluginApi`

- 位置：`src/contracts/plugin/plugin-api.ts`
- 目的：
    - 作为 Runtime / UI / Commands 共享接口，避免这些层反向依赖 `main.ts` 的具体实现。

### 4.2 `RemoteProvider` / `LocalProvider`

- 位置：`src/contracts/provider/`
- 目的：
    - 将认证、连接、scope 处理与文件系统创建统一收口到 provider 中。
    - 让 Sync Kernel 专注于 `RemoteFileSystem` / `LocalFileSystem`，而不感知底层 SDK。

### 4.3 `RemoteFileSystem` Adapter 所属边界

- 位置：
    - `src/provider/providers/<provider>/remote-file-system.ts`
- 目的：
    - 将 provider 专用的远端 IO 行为留在 provider adapter 内部。
    - 只有在至少两个 provider 需要同一种跨 provider 行为时，才考虑再抽一层共享抽象。

## 5. 关键流程

### 5.1 插件启动流程

1. `main.ts` 初始化 `PluginState` 并调用 `initializeFromStorage()`。
2. 执行设置迁移，并在需要时持久化规范化后的设置。
3. `PluginState` 根据当前活动 provider ID 构建本地 / 远端注册表。
4. 初始化 `PluginRuntime`，并执行 `restoreSession()`。
5. `commands/index.ts` 注册设置页与全部命令。
6. 根据 `autoSyncEnabled` 刷新调度器状态。

### 5.2 自动同步流程

1. `TriggerScheduler` 发出运行请求（`interval` / `local` / `manual`）。
2. `PluginRuntime` 先评估 `NetworkPolicy`。
3. `SyncCoordinator`：
    - 通过 `SessionManager` 构建当前远端 client。
    - 从 `LocalProvider` 创建本地文件系统。
    - 从 `RemoteProvider` 创建远端文件系统。
4. `SyncRunner` 执行：
    - 应用本地变更计划。
    - 拉取远端变更并生成作业。
    - 在需要时执行完整 reconcile。
    - 调用 `SyncEngine.runOnce()` 消费队列并持久化状态。

### 5.3 认证恢复流程

1. 启动时或手动触发时，`SessionManager` 会检查已存储的凭据。
2. 它调用 provider 的 `restore/refresh`；成功时写回可复用凭据并清除 auth pause。
3. 失败时进入 auth pause，阻止自动同步，并记录错误上下文。

## 6. 数据与状态

### 6.1 设置（插件设置）

- 存储：Obsidian `loadData/saveData`（`data/plugin-data.ts`）。
- 主要字段：
    - provider ID、scope ID / path、凭据、账号信息、冲突策略、自动同步开关、网络策略开关。

### 6.2 同步状态

- 存储：IndexedDB Dexie（`data/sync-db.ts`）。
- 主要表：
    - `entries`：路径状态、远端映射、基线指纹、冲突标记。
    - `jobs`：排队中的操作、优先级、重试、下次运行时间、状态。
    - `meta`：`lastSyncAt`、`lastError`、`remoteEventCursor`、运行时指标。
    - `logs`：诊断日志。

## 7. 依赖方向与约束

仓库通过 `oxlint no-restricted-imports`（见 `.oxlintrc.json`）强制模块边界。

关键约束：

- `runtime` 不得依赖 UI、commands、具体 provider 实现、`main` 或设置 UI。
- `provider` 不得依赖 sync / runtime / UI / commands / main / settings。
- `sync` 内部的导入方向按子层级受约束，以保持内核稳定。
- 作为基础模块的 `filesystem` 不得依赖上层业务逻辑。

## 8. 扩展设计

### 8.1 新增一个远端 Provider

推荐步骤：

1. 在 `provider/providers/<new-provider>/` 中实现认证与远端文件系统 adapter。
2. 实现 `RemoteProvider` 契约。
3. 在 `default-registry.ts` 中补充 provider 工厂映射。
4. 将 provider 专用的远端行为留在 provider adapter 内部，除非已经证明确有共享需求。
5. 保持 `sync/*` 不变；如有需要，仅在 UI 中补 provider 专用文案。

### 8.2 添加共享的 Provider 侧行为

推荐步骤：

1. 先直接在目标 provider adapter 内实现，并确认该行为确实跨 provider 通用。
2. 只有当至少两个 provider 需要同一行为时，才抽取共享的 provider 侧抽象。
3. 让 sync kernel 与 runtime 对 provider 专用机制保持无感。
4. 在复用前，先为抽出的 provider 行为补齐独立单元测试。

## 9. 架构决策摘要

- 使用“Provider Abstraction + Sync Kernel”分层以降低 SDK 耦合。
- 使用 `main.ts` 作为门面，并把运行时编排外提，以避免入口文件膨胀。
- 将共享契约集中在 `src/contracts/*`，并把路径工具独立保存在 `src/filesystem/path.ts`。
- 默认将远端 provider 行为保留在具体 adapter 中，而不额外维护一层策略层。

## 10. 后续演进建议

- `DriveSyncSettings` 已被重命名为 provider 无关语义；后续应继续保持这种中性命名方向。
- 将 provider registry 演进为支持并行可见的多个 provider（当前模型是按活动 ID 限定注册）。
- 如果未来再次出现共享的 provider 侧行为，必须先有明确的第二个 provider 用例，再抽取新抽象。
- 增加架构回归检查（例如自动化导入图边界校验）。
