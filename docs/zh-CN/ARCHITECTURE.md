# Obsidian Drive Sync 架构设计

## 1. 目的

这份文档描述当前代码库的架构，主要回答四个问题：

- 仓库如何分层
- 同步工作如何进入 runtime 并最终到达 sync kernel
- provider 专属代码如何与 provider 无关逻辑分离
- 新集成或新扩展应当落在哪一层

如果想看产品范围和行为要求，请读 [`SPECS.md`](./SPECS.md)。这份文档只讨论实现边界与职责归属。

## 2. 系统总览

```text
UI / Commands
      |
      v
Plugin Facade (main.ts)
      |
      v
Runtime (runtime/*)
      |                \
      |                 \-- session / policy / scheduling
      v
Sync Kernel (sync/*) <----> Filesystem Contracts (contracts/filesystem/*)
      ^
      |
Provider Layer (contracts/provider/* + provider/*)
      |
      +-- Local provider: provider/providers/obsidian/*
      +-- Remote provider: provider/providers/proton-drive/*

Persistence
  - plugin settings: Obsidian plugin data
  - sync state, jobs, logs: IndexedDB via Dexie
```

## 3. 分层职责

### 3.1 Filesystem Contracts

所属路径：

- `src/contracts/filesystem/*`
- `src/filesystem/path.ts`

职责：

- 定义 `LocalFileSystem`、`RemoteFileSystem`、`LocalChange` 等共享 IO 契约
- 定义跨层复用的路径工具

约束：

- 不包含 runtime 编排
- 不包含 provider 专属行为
- 不包含同步策略

### 3.2 Provider 层

所属路径：

- `src/provider/*`

职责：

- 暴露 `LocalProvider`、`RemoteProvider` 等 provider 级抽象
- 隔离 SDK 和平台差异
- 持有具体文件系统适配器
- 持有 provider 注册与选择逻辑

当前设计说明：

- `default-registry.ts` 构建当前激活的 provider 注册表
- 远端 provider 直接返回具体的 `RemoteFileSystem` 适配器
- 当前设计中没有启用共享的 provider 侧策略层或中间件层

### 3.3 Sync Kernel

所属路径：

- `src/sync/*`

职责：

- `planner/*`：比较本地与远端状态，并决定要做什么工作
- `engine/*`：执行任务队列、应用重试，并推进状态
- `state/*`：持久化同步状态和任务数据
- `use-cases/sync-runner.ts`：执行一次 provider 无关的同步周期

设计原则：

- sync kernel 只依赖共享契约，不依赖具体 provider 或 SDK

### 3.4 Runtime 层

所属路径：

- `src/runtime/*`

职责：

- `plugin-state.ts`：加载、规范化、持久化并暴露 provider 相关设置与状态
- `plugin-runtime.ts`：运行时组合入口和面向插件的编排 API
- `session-manager.ts`：恢复、刷新和暂停认证会话
- `trigger-scheduler.ts`：负责 interval 触发、本地防抖和 single-flight 调度
- `sync-coordinator.ts`：构造当前本地与远端文件系统，并把执行权交给 sync runner
- `network-policy.ts`：在网络失败后可选地阻断同步行为

runtime 是唯一允许同时编排 provider、会话、策略和 sync kernel 的层。

### 3.5 Plugin Facade、UI 与 Commands

所属路径：

- `src/main.ts`
- `src/ui/*`
- `src/commands/*`

职责：

- `main.ts`：插件生命周期入口，以及对 runtime 和 state 的轻量门面
- `ui/*`：基于插件对外契约构建设置页、弹窗和视图
- `commands/*`：用户触发的命令入口

规则：

- UI 不应依赖具体 provider 实现
- 命令层不应内联重复同步或 provider 逻辑
- `main.ts` 负责接线，不负责同步算法

## 4. 核心抽象

### 4.1 `ObsidianDriveSyncPluginApi`

位置：

- `src/contracts/plugin/plugin-api.ts`

目的：

- 为 runtime、UI 和 commands 提供稳定共享接口
- 防止反向依赖 `main.ts` 的实现细节

### 4.2 `RemoteProvider` 与 `LocalProvider`

位置：

- `src/contracts/provider/*`

目的：

- 把认证、连接、scope 处理和文件系统创建归到 provider 自己的职责之下
- 让 sync kernel 只关注文件系统契约，而不是 SDK 操作细节

### 4.3 远端文件系统适配器归属

位置：

- `src/provider/providers/<provider>/remote-file-system.ts`

目的：

- 把远端 IO 行为留在真正拥有它的 provider 适配器内部
- 在至少两个 provider 证明有同类需求之前，不要提前抽共享层

## 5. 主要运行流程

### 5.1 插件启动

1. `main.ts` 创建 plugin state 并加载持久化设置。
2. 如有需要，执行设置规范化或迁移。
3. 根据当前 provider ID 构建注册表。
4. 创建 `PluginRuntime` 并尝试恢复会话。
5. 注册命令和设置 UI。
6. 按当前设置刷新调度器状态。

### 5.2 同步执行

1. 命令、UI、定时器或本地变更触发一次同步请求。
2. `TriggerScheduler` 保证 single-flight。
3. `PluginRuntime` 先应用网络策略和会话检查。
4. `SyncCoordinator` 构建当前本地和远端文件系统。
5. `SyncRunner` 处理本地变更、轮询远端变更、对账并运行队列。
6. 同步状态、任务、日志和指标被持久化。

### 5.3 认证恢复

1. `SessionManager` 读取存储的凭据。
2. 它请求当前 provider 恢复或刷新会话。
3. 成功时持久化可复用凭据，并清除 auth pause。
4. 失败时进入 auth pause，并更新运行时可见错误状态。

## 6. 数据与状态

### 6.1 设置

存储位置：

- Obsidian 插件数据，通过 `loadData()` 和 `saveData()` 读写

典型字段包括：

- provider ID
- 远端 scope ID 和路径
- provider 凭据与账号摘要
- 同步策略与自动同步配置
- 网络策略开关

### 6.2 同步状态

存储位置：

- IndexedDB via Dexie

主要表：

- `entries`：路径映射、指纹、冲突标记、墓碑
- `jobs`：排队任务、优先级、重试状态和下一次执行时间
- `meta`：同步摘要、cursor 状态和运行时指标
- `logs`：结构化诊断日志

## 7. 依赖方向

仓库使用 `oxlint` 和自定义 layer check 强制分层。

关键规则：

- `runtime/` 不能依赖 UI 内部实现、命令模块、`main.ts` 或具体 provider
- `provider/` 不能依赖 `runtime/` 或 `sync/`
- `sync/` 内部必须保持 planner、engine、state 的分层，不要塌缩成一层
- 基础 filesystem contracts 不能反向依赖上层业务模块

## 8. 扩展指南

### 8.1 新增远端 Provider

1. 在 `provider/providers/<new-provider>/` 下实现认证与远端文件系统逻辑。
2. 实现 `RemoteProvider` 契约。
3. 在 `default-registry.ts` 中注册该 provider。
4. 如果需求只属于该 provider，就把行为留在它自己的实现里。
5. 除非共享契约必须演进，否则不要改 `sync/*`。

### 8.2 抽取共享 Provider 行为

1. 先在真正需要它的 provider 内实现。
2. 只有在至少两个 provider 都有相同需求时才抽共享抽象。
3. 保持 runtime 和 sync 对 provider 特性无感知。
4. 在复用之前，为抽出的行为补独立测试。

## 9. 需要保留的架构决策

- 之所以引入 provider abstraction，是为了把 SDK 耦合隔离在 sync kernel 之外。
- `main.ts` 必须继续是门面，而不是编排层。
- 共享契约统一放在 `src/contracts/*`。
- 默认情况下，远端 provider 行为留在具体 provider 适配器中。
- runtime 负责编排会话、策略和同步；sync 不得反向越层。

## 10. 后续演进

- 设置命名继续保持 provider 中立。
- 如果产品需要，provider registry 可以演进为支持多个可见 provider。
- 在引入共享 provider 侧中间件之前，必须先出现明确的第二个用例。
- 如果分层开始漂移，应增加更强的架构回归检查。
