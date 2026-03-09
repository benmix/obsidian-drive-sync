# 任务列表

## 可行性与 SDK 调研

### SDK 客户端引导

- [x] 定义 SDK 初始化要求（httpClient / account / crypto / srp / cache / telemetry）。
- [x] 构建内部 httpClient adapter，处理认证头、超时控制与 refresh。
- [x] 重构远端 provider service，使其在内部构造 client（不再要求用户提供 SDK JSON）。

### 认证与会话生命周期

- [x] 实现会话生命周期（登录、持久化、恢复、刷新、登出）。
- [x] 使用注入的 `httpClient` 验证登录流程。
- [x] 增加认证流程 UX（登录弹窗 -> ready 状态 -> 登出）。
- [x] 更新设置 UI，移除 SDK JSON 输入，并展示认证状态。
- [x] 更新认证诊断与日志（脱敏）。

### 远端操作验证

- [x] 在限定的 Remote Root 下验证 `list`、`create`、`upload`、`download`、`delete`、`move`。
- [x] 确认节点 `uid` 在 rename/move 和上传新 revision 后保持稳定。
- [x] 收集用于变更检测的远端元数据（`activeRevision.uid`、`modificationTime`、`storageSize`）。

### 文档

- [x] 记录登录 / CRUD / uid 稳定性的验证步骤。

## 核心同步

- [x] 实现 LocalFS adapter（Obsidian vault 事件 + 快照）。
- [x] 仅使用 SDK 公开 API 实现 RemoteFS adapter。
- [x] 使用 Dexie-backed IndexedDB 构建 Index DB（entries + jobs）。
- [x] 构建对账器与作业队列，确保操作幂等。
- [x] 手动同步命令：一次性 reconcile + 执行队列。
- [x] 增量本地变更（防抖 + rename 处理）。
- [x] 远端轮询快照 diff（无官方 cursor 时使用）。
- [x] 支持远端变更 cursor/feed，并在必要时回退到快照。
- [x] 冲突检测与默认处理（本地获胜 + 冲突副本）。
- [x] 健康与状态视图（队列大小、最近错误、暂停/恢复、日志）。

## 可靠性与恢复

- [x] 带退避的重试策略与 auth pause。
- [x] 基于优先级的调度与最大重试上限。
- [x] 认证错误暂停与状态上报。
- [x] 崩溃恢复与续跑（tombstone、pending jobs）。
- [x] 队列状态机与重试调度（pending / processing / blocked）。
- [x] 持久化并复用远端事件 cursor（避免短轮询 sleep）。
- [x] 增加后台 reconcile，支持限速扫描与繁忙时跳过。
- [x] 处理 rename / parent change 边界情况（冲突、顺序）。
- [x] 启动时清理陈旧 processing jobs 与孤儿状态。
- [x] 按错误类型细化重试策略（auth / rate / network / 404）。
- [x] 增加后台 reconcile，并在 auto sync 下按 15 分钟节奏限流扫描。
- [x] 在状态视图中显示 job 状态计数（pending / processing / blocked）。

## 性能

- [x] 优化大仓库性能（惰性 hash、批量处理、限流）。
- [x] 使用 mtime + size 作为变更 token，以降低 hash 成本。

## UX 与 UI

- [x] 构建远端根目录选择 UI，替代手工填写 folder ID。
- [x] 实现手动冲突处理 UI / 流程。
- [x] 扩展手动冲突处理 UI（保留本地 / 远端，恢复同步）。
- [x] 增加预同步检查（作业数量、体积估算、确认 / 中止）。
- [x] 改善同步可见性（队列详情、进行中作业、重试时间）。
- [x] 验证设置项输入（远端文件夹选择）。

## 可观测性

- [x] 增加结构化日志与 UI 中的日志查看器。
- [x] 导出包含状态与设置摘要的诊断包。
- [x] 定义诊断脱敏规则并完成隐私审查。
- [x] 增加运行时诊断指标（耗时、吞吐、失败数、队列峰值）。

## 数据与存储

- [x] 基于 `loadData/saveData` 持久化数据。
- [x] 使用 Dexie 把同步状态存到 IndexedDB（预发布阶段无需迁移）。
- [x] 用 Dexie-backed IndexedDB 替换 localStorage 同步状态。
- [x] 为未来变更规划 IndexedDB schema migration。

## 测试与兼容性

- [ ] 验证移动端兼容性（运行时测试 + UX 打磨）。
- [x] 为 reconciler、job queue、exclude rules 增加单元测试。
- [ ] 为 adapter 增加单元测试。

## 运行时架构重构

### Phase A - 保持行为不变的拆分

- [x] 将自动同步 / 会话 / 调度编排从 `main.ts` 移到 `runtime/plugin-runtime.ts`。
- [x] 保持 `main.ts` 作为插件门面（加载 / 保存设置、UI 注册、命令注册）。
- [x] 保持 UI / commands 使用的公开插件方法不变（`runAutoSync`、`pauseAutoSync`、`resumeAutoSync`、`isSyncRunning`、auth pause 状态）。

### Phase B - 编排边界

- [x] 引入 `runtime/session-manager.ts`，负责 restore / refresh / persist 认证会话逻辑。
- [x] 引入 `runtime/trigger-scheduler.ts`，负责 interval / debounce / single-flight 调度。
- [x] 将同步执行拆分为 `runtime/sync-coordinator.ts`（运行时编排）与 `sync/use-cases/sync-runner.ts`（provider 无关的单周期执行管线）。

### Phase C - 弹性扩展点

- [x] 新增可选的 `runtime/network-policy.ts`，统一网络门禁决策。

### Phase D - sync 模块布局治理

- [x] 按职责重组 `sync/`：`contracts/`、`planner/`、`engine/`、`state/`、`support/`、`use-cases/`。
- [x] 将用例级编排（`manual-sync`、`diagnostics`）迁移到 `runtime/use-cases/`。
- [x] 在更新所有导入边界与测试 / 构建时保持行为不变。
- [x] 添加 `oxlint` 导入边界守卫（`no-restricted-imports` overrides）以约束 sync 分层。

### 验证

- [x] 每个阶段后 `pnpm run test` 均通过。
- [x] `pnpm run build` 通过，且未引入新的类型不安全绕过。
- [ ] 手工检查：登录恢复、token 刷新、暂停 / 恢复、本地 rename 同步、远端 rename 同步。

## 远端 provider 抽象

### Phase A - provider 基础设施

- [x] 增加 `RemoteProvider` 契约与注册表。
- [x] 基于现有 auth / service / remote-file-system 增加默认远端 provider（`proton-drive`）。
- [x] 增加 `LocalProvider` 抽象及 Obsidian 本地 provider 实现（`local-file-system` + watcher）。
- [x] 增加 `LocalProviderRegistry` 与本地 provider 引导（`createLocalProviderRegistry`）。
- [x] 增加 provider 感知的设置字段（`remoteProviderId`、`remoteScope*`、`remoteProviderCredentials`）。

### Phase B - 运行时集成

- [x] 重构 `SessionManager`，使其通过 provider 抽象执行 restore / refresh / connect。
- [x] 重构 `SyncRunner`，通过 provider 创建远端文件系统（`provider.createRemoteFileSystem(...)`）。

### Phase C - UI 与命令迁移

- [x] 将登录 / 设置中的认证流程迁移到 provider 接口（保留当前 provider UX）。
- [x] 将命令处理器与 conflict / remote-root 弹窗迁移出直接依赖 provider service 的模式。

### 验证

- [x] provider 改造后 `pnpm run lint` 通过。
- [x] provider 改造后 `pnpm run test` 与 `pnpm run build` 通过。
- [x] 启动时执行一次旧版设置迁移，此后只持久化 provider-only 设置。

## 文件系统契约抽取

- [x] 将共享文件系统契约从旧的 sync-local 类型包中抽出到 `src/contracts/filesystem/*`。
- [x] 将 `provider/` 中的导入从旧 sync-local 类型迁移到 `src/contracts/filesystem/*`。
- [x] 将 `sync/runtime/ui/tests` 中对文件系统类型的导入迁移到 `src/contracts/filesystem/*`。
- [x] 保持 sync-run 相关契约位于 `src/contracts/sync/*`。
- [x] 增加 lint 边界，确保 `provider` 不能导入 `sync/**`，且 `filesystem` 保持轻依赖。
- [x] 验证：`pnpm run lint` + `pnpm run test` + `pnpm run build`。

## 远端限流演进

- [x] 已记录并验证 provider 自持有的远端限流方案原型。
- [x] 已重新评估额外策略 / 中间件层的维护成本。
- [x] 已从当前代码库中移除 provider 侧限流策略 / 中间件实现，以及相关测试 / 契约。
