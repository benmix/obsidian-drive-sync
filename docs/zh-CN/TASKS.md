# 任务列表

这份文档用于记录重要的已完成工作和当前最明显的缺口。它不是完整的项目管理系统，只是让仓库级优先事项在代码旁边保持可见。

## 可行性与 SDK 调研

### SDK 客户端引导

- [x] 定义 SDK 初始化要求：`httpClient`、`account`、`crypto`、`srp`、`cache`、`telemetry`。
- [x] 构建带认证头和刷新处理的内部 `httpClient` 适配器。
- [x] 重构远端 provider service 的构造方式，不再要求用户提供原始 SDK JSON。

### 认证与会话生命周期

- [x] 实现登录、持久化、恢复、刷新和登出。
- [x] 验证注入式 `httpClient` 下的登录流程。
- [x] 增加登录、就绪状态和登出的认证 UX。
- [x] 从设置里移除过时的 SDK JSON 输入，并改为展示认证状态。
- [x] 增加带脱敏的认证诊断与日志。

### 远端操作验证

- [x] 在受限远端根目录中验证 `list`、`create`、`upload`、`download`、`delete`、`move`。
- [x] 验证节点 `uid` 在重命名、移动和新 revision 上传后保持稳定。
- [x] 收集远端元数据用于变更检测。

### 文档

- [x] 补充登录、CRUD 校验和 UID 稳定性的验证文档。

## 核心同步

- [x] 基于 Obsidian vault 事件和快照读取实现本地文件系统适配器。
- [x] 基于公开 SDK API 实现远端文件系统适配器。
- [x] 构建基于 Dexie 的索引和任务队列。
- [x] 构建对账逻辑和幂等任务执行。
- [x] 增加一次性手动同步命令。
- [x] 处理带防抖和 rename 支持的本地增量变更。
- [x] 增加远端快照 diff 轮询。
- [x] 增加远端 cursor/feed 支持，并在必要时回退到快照 diff。
- [x] 增加冲突检测和默认冲突副本行为。
- [x] 增加展示队列状态、暂停/恢复、错误和日志的状态视图。

## 可靠性与恢复

- [x] 增加重试策略、退避和 auth pause。
- [x] 增加优先级调度和重试上限。
- [x] 持久化 auth pause 状态并在 UI 中显示。
- [x] 支持崩溃恢复和任务续跑。
- [x] 为任务队列增加 pending、processing、blocked 状态。
- [x] 持久化并复用远端事件 cursor。
- [x] 增加带节流和 busy 跳过机制的后台对账。
- [x] 处理 rename 与父目录变更的边界情况。
- [x] 启动时清理陈旧 processing 任务和孤儿状态。
- [x] 按错误类别细化重试策略。
- [x] 在状态视图中显示 pending、processing、blocked 计数。

## 性能

- [x] 通过懒哈希、批处理和节流改善大 vault 表现。
- [x] 增加 `mtime + size` 变更 token，减少哈希计算。

## UX 与 UI

- [x] 用远端根目录选择器替代手输 folder ID。
- [x] 增加工冲突处理流程。
- [x] 扩展冲突处理选项，支持保留本地、保留远端并恢复同步。
- [x] 增加 pre-sync 检查，包括任务数量、体积估算和确认。
- [x] 改进队列可见性和重试时间展示。
- [x] 校验远端目录相关设置输入。

## 可观测性

- [x] 增加结构化日志和应用内日志查看器。
- [x] 导出包含状态与设置摘要的诊断包。
- [x] 定义脱敏规则和隐私边界。
- [x] 增加运行时指标，如耗时、吞吐、失败率和队列峰值。

## 数据与存储

- [x] 通过 `loadData()` / `saveData()` 持久化插件设置。
- [x] 将同步状态迁移到基于 Dexie 的 IndexedDB。
- [x] 移除 localStorage 版同步状态。
- [x] 规划未来 schema 迁移规则。

## 测试与兼容性

- [ ] 验证移动端兼容性，包括运行时检查和 UX 审视。
- [x] 为 reconciler、queue 和 exclude rules 增加单元测试。
- [ ] 增加更完整的 adapter 级单元测试。

## 运行时架构重构

### Phase A：保持行为不变的拆分

- [x] 将 auto-sync、session 和 scheduler 编排从 `main.ts` 拆到 `runtime/plugin-runtime.ts`。
- [x] 保持 `main.ts` 是轻量门面。
- [x] 保留 UI 与 commands 依赖的插件公开方法。

### Phase B：编排边界

- [x] 增加 `runtime/session-manager.ts` 负责认证恢复与刷新。
- [x] 增加 `runtime/trigger-scheduler.ts` 负责 interval、防抖和 single-flight。
- [x] 在 `runtime/sync-coordinator.ts` 与 `sync/use-cases/sync-runner.ts` 之间拆分执行职责。

### Phase C：弹性扩展点

- [x] 增加可选的 `runtime/network-policy.ts`。

### Phase D：sync 模块布局治理

- [x] 按职责重组 `sync/` 目录。
- [x] 将 manual-sync 和 diagnostics 编排移动到 `runtime/use-cases/`。
- [x] 在不改行为的前提下更新导入边界和测试。
- [x] 增加 `oxlint` 边界检查，约束 sync 层依赖方向。

### 验证

- [x] 每个阶段后 `pnpm run test` 都通过。
- [x] 每个阶段后 `pnpm run build` 都通过。
- [ ] 仍需补充 session restore、token refresh、pause/resume、local/remote rename 的人工检查。

## 远端 Provider 抽象

### Phase A：Provider 基础设施

- [x] 增加 `RemoteProvider` 契约与注册表。
- [x] 增加默认远端 provider `proton-drive` 的实现。
- [x] 增加 `LocalProvider` 抽象与 Obsidian 本地 provider。
- [x] 增加 `LocalProviderRegistry` 启动接线。
- [x] 增加 provider 导向的设置字段。

### Phase B：运行时集成

- [x] 让 `SessionManager` 通过 provider 接口恢复、刷新和连接。
- [x] 让 `SyncRunner` 通过 provider 创建远端文件系统。

### Phase C：UI 与命令迁移

- [x] 把登录和设置中的认证流程迁移到 provider 接口上。
- [x] 把命令处理器和弹窗流程从直接调用 provider service 改为走 provider API。

### 验证

- [x] provider 改动后 `pnpm run lint` 通过。
- [x] provider 改动后 `pnpm run test` 通过。
- [x] provider 改动后 `pnpm run build` 通过。
- [x] 移除旧设置迁移路径，仅保留 provider 字段持久化。

## 文件系统契约抽取

- [x] 将共享文件系统契约抽取到 `src/contracts/filesystem/*`。
- [x] 把 provider 侧导入迁移到新的 filesystem contracts。
- [x] 迁移 sync、runtime、UI 和测试中的相关导入。
- [x] 保留 sync-run 契约在 `src/contracts/sync/*`。
- [x] 增加 lint 边界，确保 `provider/` 不能导入 `sync/**`，同时保持 filesystem 基础层轻依赖。
- [x] 通过 `pnpm run lint`、`pnpm run test` 和 `pnpm run build` 验证。

## 远端限流演进

- [x] 记录并原型化 provider 自有远端限流方案。
- [x] 重新评估额外 provider 侧策略层的维护成本。
- [x] 从当前代码库中删除未被采用的 provider 侧限流策略及相关测试和契约。
