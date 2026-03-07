---

# Obsidian Drive Sync

**Technical Specification (Specs v1.0)**

---

## 1. Overview

### 1.1 Product Name

**Obsidian Drive Sync Plugin**

### 1.2 Purpose

为 Obsidian 提供一个插件，使本地 Vault 与远端 Provider 上指定目录实现**可靠的双向同步**，具备冲突检测、失败恢复与可观测性。

### 1.3 Non-Goals

- 不替换 Obsidian 原生 Vault Adapter
- 不实现多人实时协同编辑
- 不实现远端 Provider API 之外的自建后端
- 不保证与 Obsidian Sync 的状态一致性

---

## 2. Scope

### 2.1 In Scope

- 本地 Vault ↔ 远端 Provider 目录的双向同步
- 文件/目录的 create / modify / delete / rename
- 冲突检测与自动解决（默认策略）
- 会话恢复、失败重试、断点续跑
- 桌面端（macOS / Windows / Linux）

### 2.2 Out of Scope

- 移动端完整自动同步（可后续降级支持）
- 富文本级别的 merge（仅文件级）

---

## 3. Terminology

| Term            | Definition                       |
| --------------- | -------------------------------- |
| Vault           | Obsidian 管理的本地文件目录      |
| Remote Root     | 远端 Provider 上作为同步根的目录 |
| relPath         | 相对于 Vault 根目录的规范化路径  |
| node uid        | 远端节点稳定标识                 |
| Index           | 本地维护的同步状态数据库         |
| Job             | 一个可幂等执行的同步任务         |
| Synced Baseline | 上一次成功同步时的本地/远端指纹  |

---

## 4. High-Level Architecture

### 4.1 Component Model

- **UI Layer**
    - Settings Tab
    - Sync Status View
    - Command Palette Commands

- **Sync Orchestrator**
    - Reconciler（对齐本地与远端状态）
    - Scheduler（调度任务队列）
    - State Machine（路径级状态）

- **Filesystem Contracts Layer**
    - 提供 `LocalFileSystem` / `RemoteFileSystem` / `LocalChange` 等共享类型契约
    - 为 `sync/` 与 `provider/` 的共同底层依赖，不包含业务流程逻辑

- **LocalFS Adapter**
    - 基于 Obsidian Vault API
    - 提供事件流与文件操作能力

- **RemoteFS Adapter**
    - 远端 Provider SDK 的唯一依赖层
    - 提供统一的远端文件系统抽象

- **Persistence Layer**

- Index DB（IndexedDB via Dexie）
    - Job Queue
    - Remote Cursor / Snapshot Metadata

---

## 5. Authentication & Session

### 5.1 Authentication Model

- 基于 Proton Account 的 **SDK 会话机制**（由 `httpClient` 注入实现）
- 登录形态：用户名 + 密码 +（可选）2FA
- 插件**不保存明文密码**

### 5.4 SDK Client Bootstrapping Requirements

- `httpClient`: 由插件提供的 fetch 适配器，负责附加 auth headers、超时控制、401 refresh + retry。
- `account`: 基于 Proton API 的账户接口，提供地址/公钥/私钥解密能力。
- `crypto`: OpenPGP + crypto proxy 封装（SDK 需要的加解密模块）。
- `srp`: SRP 模块（登录/会话相关的 SRP 计算）。
- `cache`: `entitiesCache` + `cryptoCache`（MemoryCache）用于 SDK 内部状态。
- `telemetry`: SDK Telemetry 适配，映射到插件日志（不记录敏感信息）。

### 5.2 Session Persistence

- 持久化内容：SDK 接入层的 **会话凭据（opaque）**，由 `httpClient` 管理
- 生命周期：
    1. Plugin start → restore session
    2. If expired/invalid → re-auth via login flow
    3. If failed → prompt login

### 5.3 Security Requirements

- 不记录敏感字段到日志
- 支持用户手动“Sign out & Clear Session”
- Session 失败需显式中断同步

---

## 6. Local Filesystem Specification

### 6.1 Event Sources

来自 Obsidian Vault API 的事件：

- `create`
- `modify`
- `delete`
- `rename(oldPath, newPath)`

### 6.2 Event Normalization

- 路径统一为 `/` 分隔
- 去除 `.` / `..`
- 统一大小写策略（配置项）

### 6.3 Event Debounce

- 同一路径事件合并窗口：**300–800ms**
- rename 优先级高于 create/delete

---

## 7. Remote Filesystem Specification

### 7.1 Remote Root

- 同步范围限定在一个用户指定的 Remote Root
- 插件不得访问该目录以外的资源

### 7.2 Required Remote Capabilities

RemoteFS Adapter 必须提供：

- list tree（分页）
- upload (create/update)
- download
- delete
- move/rename
- stable identifier（`node uid`）
- revision / etag / mtime（至少一种）

### 7.3 Remote Change Detection

- **Preferred**：cursor / changes feed（SDK tree events）
- **Fallback**：periodic snapshot diff

---

## 8. Index Database Specification

### 8.1 Table: `entries`

| Field           | Type    | Notes          |
| --------------- | ------- | -------------- |
| relPath         | TEXT PK | 规范化路径     |
| type            | ENUM    | file / folder  |
| localMtimeMs    | INTEGER |                |
| localSize       | INTEGER |                |
| localHash       | TEXT    | sha256，可懒算 |
| remoteId        | TEXT    | node uid       |
| remoteRev       | TEXT    | revision uid   |
| syncedLocalHash | TEXT    | 同步基线       |
| syncedRemoteRev | TEXT    | 同步基线       |
| tombstone       | BOOLEAN | 删除标记       |
| lastSyncAt      | INTEGER |                |

### 8.2 Table: `jobs`

| Field     | Type    |
| --------- | ------- |
| id        | TEXT PK |
| op        | ENUM    |
| path      | TEXT    |
| fromPath  | TEXT    |
| toPath    | TEXT    |
| priority  | INTEGER |
| attempt   | INTEGER |
| nextRunAt | INTEGER |
| reason    | ENUM    |

### 8.3 Storage Backend

- IndexedDB via Dexie (browser-safe, Obsidian-compatible).
- Settings remain in Obsidian plugin data; sync state lives in IndexedDB.
- Schema migrations are handled via Dexie versioning (see 8.4).

### 8.4 IndexedDB schema migrations

Migration rules:

- Every schema change increments `SYNC_STATE_DB_VERSION` and adds a new Dexie `.version(n).stores(...)`.
- Use `modify`/`add`/`delete` in Dexie to transform data when required.
- Keep at least one backward-compatible reader for one release (N-1) to allow safe upgrades.
- For breaking changes, implement a reindex path (clear + rebuild) with a user-visible warning.
- Avoid dropping tables silently; log and preserve critical records when possible.

Planned changes (placeholders to keep versioning consistent):

- v3: Add `status` index to jobs (already in schema) and migration guard to backfill missing fields.
- v4: Add `runtimeMetrics` extended fields (if needed) without changing entry/job keys.

---

## 9. Sync State Machine

### 9.1 Path-Level States

- `Clean`
- `LocalDirty`
- `RemoteDirty`
- `Conflict`
- `Syncing`
- `Error`

### 9.2 State Transitions (Simplified)

| From        | Event             | To          |
| ----------- | ----------------- | ----------- |
| Clean       | Local modify      | LocalDirty  |
| Clean       | Remote change     | RemoteDirty |
| LocalDirty  | Upload success    | Clean       |
| RemoteDirty | Download success  | Clean       |
| \*          | Conflict detected | Conflict    |
| \*          | Fatal error       | Error       |

---

## 10. Conflict Detection & Resolution

### 10.1 Detection Rule

```
localChanged  = localHash  != syncedLocalHash
remoteChanged = remoteRev != syncedRemoteRev

if localChanged && remoteChanged → Conflict
```

### 10.2 Default Resolution Strategy

- 本地版本保留为主
- 远端版本下载为：

    ```
    filename (Proton conflicted YYYY-MM-DD HHmm).ext
    ```

- 两者均写入 Index

### 10.3 Configurable Strategies

- Local wins (default)
- Remote wins
- Manual (pause + notify)

---

## 11. Job Queue & Execution

### 11.1 Job Types

- `upload`
- `download`
- `deleteRemote`
- `deleteLocal`
- `moveRemote`
- `moveLocal`
- `mkdirRemote`
- `mkdirLocal`

### 11.2 Execution Rules

- 同一路径串行
- move/delete 优先于 content
- priority-aware scheduling（高优先级先执行）
- 并发上限：2（内置，不可配置）
- 所有 job 必须 **幂等**
- Queue 状态机：pending / processing / blocked
- retryAt 调度与可视化

### 11.3 Retry Policy

- 网络 / 5xx：指数退避
- Auth error：暂停并要求重新登录
- 按错误类别区分退避（rate/network/404 等）
- 超过最大重试（内置 5 次）→ Error 状态

---

## 12. Startup & Recovery

### 12.1 Plugin Startup Flow

1. Load Index DB
2. Restore session
3. Local quick scan（mtime/size）
4. Pull remote changes
5. Reconcile → enqueue jobs
6. Start workers

### 12.2 Crash Recovery

- 未完成 job 继续执行
- tombstone 保留，避免重复创建/删除
- 支持 “Rebuild Index” 命令
- 启动清理 stale processing job 与 orphaned state

---

## 13. UI & UX Requirements

### 13.1 Settings

- Account login/logout
- Remote Root selector
- Exclude rules（支持 `*`/`**`，包含校验与预览）
- Conflict strategy
- Auto sync on/off

### 13.2 Status View

- Current state
- Queue length
- In-flight job + next retry time
- Last error
- Manual sync / pause / resume
- Conflicts summary
- Recent logs

### 13.3 Commands

- Sync now
- Pause / Resume
- Rebuild index
- Export diagnostics
- Review conflicts

---

## 14. Performance Requirements

- Vault ≤ 50k files 可启动
- 不阻塞 Obsidian 主线程
- Hash 计算懒执行
- 远端遍历分页 + 限流
- 预同步检查（作业数量、大小估算、确认/取消）
- 背景 reconciliation + 扫描节流

---

## 15. Observability

- Structured logs（不含敏感信息）
- Job-level error tracking
- 可导出诊断包（脱敏）
- 日志查看（状态视图）
- 运行指标（耗时、吞吐、失败率、队列峰值）

---

## 16. Risks & Mitigations

| Risk              | Mitigation               |
| ----------------- | ------------------------ |
| Proton SDK 不稳定 | RemoteFS Facade 隔离     |
| 无远端 cursor     | 快照 diff + 优化         |
| 大 Vault 性能     | 分层扫描 + 限流          |
| 外部 rename       | rename 推断窗口（后续）  |
| 事件 cursor 抖动  | 持久化 cursor + 回退快照 |
| 移动端差异        | 降级路径 + 运行时检测    |

---

## 17. Milestones

### Phase 0 – Feasibility

- SDK 登录 + list/upload/download 验证

### Phase 1 – MVP

- 双向同步（手动触发）
- Index + Job Queue
- 基础冲突处理

### Phase 2 – GA

- 自动同步
- 远端增量
- 完整恢复与诊断

---

## 18. Open Questions

- 是否存在官方 change feed / cursor
- 是否能在 SDK 公共 API 中获得更强的远端变更指纹（etag/mtime/size 组合）

---

## 19. Runtime Refactor Plan (2026-03)

### 19.1 Goals

- 将插件入口与同步编排解耦：`main.ts` 保持“壳层”职责，运行时逻辑下沉至 `runtime/*`。
- 保持同步内核语义不变：`reconciler + queue + executor` 作为稳定内核，不在本轮重构改写算法。
- 提升可测试性：调度、会话、单轮执行可独立测试。

### 19.2 Target layering

- **Plugin Facade (`main.ts`)**
    - settings load/save
    - UI tab / commands registration
    - lifecycle delegation

- **Runtime Layer (`runtime/*`)**
    - `plugin-runtime.ts`: high-level orchestration and plugin-facing API
    - `session-manager.ts`: restore/refresh/persist auth session
    - `trigger-scheduler.ts`: interval + local debounce + pending single-flight
    - `sync-coordinator.ts`: runtime orchestration for provider/session/scope
    - `use-cases/*`: manual sync and diagnostics orchestration

- **Sync Kernel (`sync/*`)**
    - `contracts/*`: stable file system contracts and event types
    - `planner/*`: local/remote planning + reconciliation policies
    - `engine/*`: execution engine and queue
    - `state/*`: state store and in-memory index model
    - `support/*`: shared helpers
    - `use-cases/*`: provider-agnostic one-cycle sync execution
    - keeps conflict/retry/state semantics unchanged

- **Provider remote file system strategy boundary (`provider/strategy/*`)**
    - shared, composable `RemoteFileSystem` decorators/strategies
    - provider-owned composition (runtime does not inject decorators)
    - layering constraints are enforced by lint (`no-restricted-imports` overrides)

### 19.3 Non-goals for this refactor

- 不引入新的冲突策略。
- 不改变任务优先级和重试策略语义。
- 不切换存储后端（继续使用 Dexie IndexedDB + plugin data settings）。

### 19.4 Rollout phases

1. **Phase A (behavior-preserving split)**
    - extract orchestration from `main.ts` into `runtime/plugin-runtime.ts`
    - keep public plugin methods stable for UI/commands compatibility

2. **Phase B (orchestration boundaries)**
    - split session/scheduler/runner into dedicated runtime modules

3. **Phase C (resilience extensions)**
    - add `NetworkPolicy` runtime module (feature-flagged)
    - add provider-scoped `RateLimitedRemoteFileSystem` strategy chain (provider default)
    - evolve remote rate limiter to adaptive cooldown on 429/transient failures

### 19.5 Acceptance criteria

- `pnpm run test` and `pnpm run build` pass after each phase.
- No regression in manual scenarios:
    - session restore
    - token refresh
    - pause/resume auto sync
    - local/remote rename synchronization

## 20. Remote Provider Abstraction Plan (2026-03)

### 20.1 Goals

- 将“远端文件操作”与“认证/连接/作用域校验”统一抽象为 provider 层。
- 在不改 sync kernel 算法的前提下，支持未来接入非 Proton 的远端 provider。
- 保持默认体验不变（默认 provider 仍为 `proton-drive`）。

### 20.2 New abstractions

- **RemoteProvider**
    - `login/restore/refresh/logout`
    - `connect/disconnect`
    - `createRemoteFileSystem(client, scopeId)`
    - `validateScope(client, scopeId)`

- **LocalProvider**
    - `createLocalFileSystem(app)`
    - `createLocalWatcher(app, onChange, registerEvent, debounceMs)`

- **LocalProviderRegistry**
    - local provider discovery by `localProviderId`
    - default fallback to `obsidian-local`

- **RemoteProviderRegistry**
    - provider discovery by `remoteProviderId`
    - default fallback to `proton-drive`

### 20.3 Settings model evolution

- New provider-oriented fields:
    - `remoteProviderId`
    - `remoteScopeId` / `remoteScopePath`
    - `remoteProviderCredentials`
    - `remoteAccountEmail`
    - `remoteHasAuthSession`

- Compatibility policy:
    - run one-time migration on load from legacy Proton fields (`protonSession`, `remoteFolderId`, etc.) to provider fields
    - persist provider-only settings after migration (no dual-write back-compat fields)
    - remove legacy settings paths from runtime reads/writes

### 20.4 Rollout phases

1. **Phase A**
    - add provider contracts/registry and Proton provider implementation

2. **Phase B**
    - migrate runtime session/sync runner to provider interfaces

3. **Phase C**
    - migrate settings/login/commands/modals from direct Proton services to provider APIs

4. **Phase D**
    - delete unused Proton-only helper modules and keep provider use-cases as the only sync entrypoints

### 20.5 Acceptance criteria

- Providerized runtime works with existing Proton data/state.
- No behavior regression in login restore, token refresh, auto-sync, manual sync.
- Lint/test/build remain green after each phase.

### 20.6 Implementation status (2026-03-06)

- Phase A/B/C 已完成（provider contracts/registry、runtime、settings/login/commands/modals）。
- 新增 provider session helper，统一 restore/refresh/connect 的会话处理路径。
- 为 provider 增加 `getRootScope(...)`，remote folder selector 不再依赖 Proton SDK 细节。
- 已移除 legacy settings 双写回兼容路径，改为一次性迁移后仅保存 provider 字段。
- 当前验证结果：`pnpm run lint`、`pnpm run test`、`pnpm run build` 全部通过。

---
