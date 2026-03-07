# Obsidian Drive Sync 架构设计文档

## 1. 文档目标

本文件描述当前代码实现对应的架构设计，重点回答以下问题：

- 模块如何分层，边界在哪里。
- 同步流程如何从 UI/命令进入并最终执行。
- Provider 与 Sync Kernel 如何解耦。
- 后续扩展新 Provider / 新策略应落在哪一层。

本文档是工程实现导向，不重复产品需求细节。产品范围与功能规格请参考 `docs/SPECS.md`。

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
Sync Kernel (sync/*)  <---->  Filesystem Contracts (filesystem/*)
      ^
      |
Provider Abstraction (provider/contracts + registry)
      |
      +-- Local Provider impl (provider/providers/obsidian/*)
      +-- Remote Provider impl (provider/providers/proton-drive/*)
             |
             +-- RemoteFileSystem Strategy Chain (provider/strategy/*)

Data Layer
  - Plugin settings: Obsidian plugin data (data/plugin-data.ts)
  - Sync state/index/jobs/logs: IndexedDB Dexie (data/sync-db.ts + sync/state/*)
```

## 3. 分层与职责

### 3.1 Filesystem Contracts（底层共享契约）

- 目录：`src/filesystem/*`
- 职责：
    - 定义 `LocalFileSystem`、`RemoteFileSystem`、`LocalChange` 等通用 IO 契约。
    - 提供路径工具（`path.ts`）作为跨层可复用基础能力。
- 约束：
    - 仅做类型与基础工具，不承载业务流程。

### 3.2 Provider Layer（外部系统接入层）

- 目录：`src/provider/*`
- 职责：
    - 统一本地与远端能力抽象（`LocalProvider` / `RemoteProvider`）。
    - 通过 Registry 管理当前激活 Provider。
    - 屏蔽具体 SDK 与平台 API 差异。
- 关键点：
    - `default-registry.ts` 按激活 ID 只注册需要的 Provider。
    - `strategy/*` 提供 Provider 侧可插拔策略链。

### 3.3 Sync Kernel（同步内核）

- 目录：`src/sync/*`
- 职责：
    - `planner/*`：变更探测与对账（local/remote/reconcile）。
    - `engine/*`：任务队列执行、重试、状态推进。
    - `state/*`：同步状态读写抽象。
    - `use-cases/sync-runner.ts`：单轮同步总入口。
- 设计原则：
    - Provider 无关，只依赖 `filesystem/contracts` 抽象。

### 3.4 Runtime Layer（运行时编排层）

- 目录：`src/runtime/*`
- 职责：
    - `plugin-runtime.ts`：生命周期编排中枢。
    - `session-manager.ts`：会话恢复、刷新、认证暂停控制。
    - `trigger-scheduler.ts`：interval + local change debounce + single-flight。
    - `sync-coordinator.ts`：拼装 local/remote file system 并调用 `SyncRunner`。
    - `network-policy.ts`：网络门禁与失败冷却（可开关）。

### 3.5 Plugin Facade / UI / Commands（外层交互）

- `main.ts`
    - 插件入口壳层，负责：加载/迁移/保存设置、初始化 registry、挂接 runtime、注册 UI 与命令。
- `ui/*`
    - 仅依赖插件 API 与 Provider 抽象，不直接依赖 provider 具体实现。
- `commands/*`
    - 触发运行时 use-cases，不直接耦合具体 SDK。

## 4. 核心抽象

### 4.1 `ObsidianDriveSyncPluginApi`

- 目录：`src/plugin/contracts.ts`
- 作用：
    - Runtime/UI/Commands 统一依赖此接口，避免反向依赖 `main.ts` 实现细节。

### 4.2 `RemoteProvider` / `LocalProvider`

- 目录：`src/provider/contracts.ts`
- 作用：
    - 将认证、连接、作用域、文件系统创建统一收敛到 Provider。
    - Sync Kernel 仅消费 `RemoteFileSystem` / `LocalFileSystem`，不感知 SDK。

### 4.3 RemoteFileSystem Strategy Chain

- 目录：
    - `src/provider/strategy/contracts.ts`
    - `src/provider/strategy/*`
- 作用：
    - 在 Provider 内部装配跨 Provider 可复用策略（例如 rate limit）。
    - Runtime 不注入策略，不暴露外部配置开关。

## 5. 关键时序

### 5.1 插件启动时序

1. `main.ts` 读取 plugin data。
2. 执行设置迁移并保存规范化设置。
3. 按激活 provider ID 构建 local/remote registry。
4. 初始化 `PluginRuntime` 并调用 `restoreSession()`。
5. 注册 SettingTab 与 Commands。
6. 根据 `autoSyncEnabled` 刷新调度器。

### 5.2 自动同步时序

1. `TriggerScheduler` 触发 run request（`interval` / `local` / `manual`）。
2. `PluginRuntime` 先执行 `NetworkPolicy` 判定。
3. `SyncCoordinator`：
    - 通过 `SessionManager` 建立 active remote client。
    - 从 LocalProvider 创建 local file system。
    - 从 RemoteProvider 创建 remote file system（包含 provider 内部策略链）。
4. `SyncRunner` 执行：
    - 应用本地变更计划。
    - 轮询远端变更并生成任务。
    - 需要时执行全量 reconcile。
    - 驱动 `SyncEngine.runOnce()` 消费任务队列并持久化状态。

### 5.3 认证恢复时序

1. 启动或手动触发时，`SessionManager` 检查保存的 credentials。
2. 调用 Provider `restore/refresh`，成功后回写可复用凭据并解除 auth pause。
3. 失败时进入 auth pause，阻断自动同步并给出错误上下文。

## 6. 数据与状态

### 6.1 Settings（插件设置）

- 存储：Obsidian `loadData/saveData`（`data/plugin-data.ts`）。
- 主要内容：
    - provider id、scope id/path、凭据、账号信息、冲突策略、自动同步开关、网络策略开关。

### 6.2 Sync State（同步状态）

- 存储：IndexedDB Dexie（`data/sync-db.ts`）。
- 主要表：
    - `entries`：路径状态、remote 映射、基线指纹、冲突标记。
    - `jobs`：任务队列、优先级、重试、下次执行时间、状态。
    - `meta`：`lastSyncAt`、`lastError`、`remoteEventCursor`、runtime metrics。
    - `logs`：诊断日志。

## 7. 依赖方向与约束

仓库通过 `oxlint no-restricted-imports` 做模块边界约束（见 `.oxlintrc.json`）。

关键约束：

- `runtime` 不依赖 UI、commands、provider 具体实现、main/settings UI。
- `provider` 不依赖 sync/runtime/UI/commands/main/settings。
- `sync` 内部按子层限制导入方向，保持 kernel 稳定。
- `filesystem` 作为底层模块，不依赖上层业务模块。

## 8. 扩展设计

### 8.1 新增 Remote Provider

推荐步骤：

1. 在 `provider/providers/<new-provider>/` 实现认证与 remote file system 适配。
2. 实现 `RemoteProvider` 契约。
3. 在 `default-registry.ts` 增加 provider factory 映射。
4. 复用 `provider/strategy/*` 中的通用策略（按需组合）。
5. 保持 `sync/*` 无改动；必要时仅在 UI 增加 provider-specific 文案。

### 8.2 新增 RemoteFileSystem 策略

推荐步骤：

1. 在 `provider/strategy/` 新建策略实现。
2. 保持输入输出都是 `RemoteFileSystem -> RemoteFileSystem`。
3. 在目标 provider 的 `createRemoteFileSystem` 中注入策略。
4. 为策略增加独立单测，避免影响 sync kernel 测试。

## 9. 架构决策摘要

- 采用 “Provider 抽象 + Sync Kernel” 的分层，降低 SDK 耦合。
- `main.ts` 作为 facade，runtime 负责编排，避免入口文件持续膨胀。
- 路径与文件系统基础能力下沉到 `filesystem`，避免跨层工具重导出。
- 远端限流采用 Provider 内聚策略链，避免外部配置漂移。

## 10. 后续演进建议

- `DriveSyncSettings` 已完成去品牌化命名，后续保持 provider-neutral 语义。
- provider registry 支持多 provider 并行可见（当前为按激活 ID 单注册）。
- 增加策略链运行指标（等待时长、命中次数、错误分类分布）。
- 增加架构回归检查（例如按目录自动校验 import graph）。
