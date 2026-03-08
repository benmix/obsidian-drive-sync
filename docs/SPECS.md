---

# Obsidian Drive Sync

**Technical Specification (Specs v1.0)**

---

## 1. Overview

### 1.1 Product Name

**Obsidian Drive Sync Plugin**

### 1.2 Purpose

Provide an Obsidian plugin that delivers **reliable two-way synchronization** between a local vault and a designated directory on a remote provider, with conflict detection, failure recovery, and observability.

### 1.3 Non-Goals

- Do not replace the native Obsidian vault adapter.
- Do not implement real-time multi-user collaboration.
- Do not implement a custom backend beyond remote provider APIs.
- Do not guarantee state consistency with Obsidian Sync.

---

## 2. Scope

### 2.1 In Scope

- Two-way sync between local vault and remote provider directory.
- File/folder create / modify / delete / rename.
- Conflict detection and automatic handling (default policy).
- Session restore, retry, and resumable execution.
- Desktop platforms (macOS / Windows / Linux).

### 2.2 Out of Scope

- Full mobile auto-sync behavior (possible degraded support later).
- Rich-text level merge (file-level only).

---

## 3. Terminology

| Term            | Definition                                       |
| --------------- | ------------------------------------------------ |
| Vault           | Local file directory managed by Obsidian         |
| Remote Root     | The remote provider directory used as sync root  |
| relPath         | Normalized path relative to vault root           |
| node uid        | Stable identifier of a remote node               |
| Index           | Local sync state database                        |
| Job             | An idempotent sync task                          |
| Synced Baseline | Local/remote fingerprint at last successful sync |

---

## 4. High-Level Architecture

### 4.1 Component Model

- **UI Layer**
    - Settings Tab
    - Sync Status View
    - Command Palette Commands

- **Sync Orchestrator**
    - Reconciler (align local and remote state)
    - Scheduler (schedule task queue)
    - State Machine (path-level state)

- **Filesystem Contracts Layer**
    - Provides shared type contracts like `LocalFileSystem` / `RemoteFileSystem` / `LocalChange`.
    - Shared foundational dependency for `sync/` and `provider/`; contains no business workflow logic.

- **LocalFS Adapter**
    - Built on Obsidian Vault API.
    - Provides event stream and file operation capabilities.

- **RemoteFS Adapter**
    - Sole dependency layer for remote provider SDK.
    - Exposes a unified remote filesystem abstraction.

- **Persistence Layer**
    - Index DB (IndexedDB via Dexie)
    - Job Queue
    - Remote Cursor / Snapshot Metadata

---

## 5. Authentication & Session

### 5.1 Authentication Model

- Uses remote provider account based **SDK session mechanism** (implemented via injected `httpClient`).
- Login shape: username + password + optional 2FA.
- Plugin does **not** persist plaintext password.

### 5.4 SDK Client Bootstrapping Requirements

- `httpClient`: plugin-provided fetch adapter that adds auth headers, timeout control, and 401 refresh + retry.
- `account`: account interface based on remote provider API, for address/key/private-key decryption related capabilities.
- `crypto`: OpenPGP + crypto proxy wrapper required by SDK cryptographic interfaces.
- `srp`: SRP module for login/session calculations.
- `cache`: `entitiesCache` + `cryptoCache` (MemoryCache) for SDK internal state.
- `telemetry`: SDK telemetry adapter mapped to plugin logs (no sensitive fields).

### 5.2 Session Persistence

- Persisted payload: opaque session credentials managed by SDK integration layer (`httpClient`).
- Lifecycle:
    1. Plugin start -> restore session
    2. If expired/invalid -> re-auth via login flow
    3. If failed -> prompt login

### 5.3 Security Requirements

- Do not log sensitive fields.
- Support user action: "Sign out & Clear Session".
- Sync must be explicitly interrupted when session fails.

---

## 6. Local Filesystem Specification

### 6.1 Event Sources

Events from Obsidian Vault API:

- `create`
- `modify`
- `delete`
- `rename(oldPath, newPath)`

### 6.2 Event Normalization

- Normalize path separators to `/`.
- Remove `.` / `..`.
- Apply unified case strategy (configurable).

### 6.3 Event Debounce

- Same-path merge window: **300–800ms**.
- Rename has higher priority than create/delete.

---

## 7. Remote Filesystem Specification

### 7.1 Remote Root

- Sync scope is limited to one user-selected remote root.
- Plugin must not access resources outside that directory.

### 7.2 Required Remote Capabilities

RemoteFS adapter must provide:

- list tree (paginated)
- upload (create/update)
- download
- delete
- move/rename
- stable identifier (`node uid`)
- revision / etag / mtime (at least one)

### 7.3 Remote Change Detection

- **Preferred**: cursor / changes feed (SDK tree events)
- **Fallback**: periodic snapshot diff

---

## 8. Index Database Specification

### 8.1 Table: `entries`

| Field           | Type    | Notes                   |
| --------------- | ------- | ----------------------- |
| relPath         | TEXT PK | Normalized path         |
| type            | ENUM    | file / folder           |
| localMtimeMs    | INTEGER |                         |
| localSize       | INTEGER |                         |
| localHash       | TEXT    | sha256, lazily computed |
| remoteId        | TEXT    | node uid                |
| remoteRev       | TEXT    | revision uid            |
| syncedLocalHash | TEXT    | sync baseline           |
| syncedRemoteRev | TEXT    | sync baseline           |
| tombstone       | BOOLEAN | deletion marker         |
| lastSyncAt      | INTEGER |                         |

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
- Schema migrations are handled through Dexie versioning (see 8.4).

### 8.4 IndexedDB schema migrations

Migration rules:

- Every schema change increments `SYNC_STATE_DB_VERSION` and adds a new Dexie `.version(n).stores(...)`.
- Use `modify`/`add`/`delete` in Dexie when data transformation is needed.
- Keep at least one backward-compatible reader for one release (N-1).
- For breaking changes, provide reindex path (clear + rebuild) with user-visible warning.
- Avoid silent table drops; preserve critical records when possible.

Planned changes (placeholders to keep versioning consistent):

- v3: Add `status` index to jobs (already in schema) and migration guard for missing field backfill.
- v4: Add extended `runtimeMetrics` fields (if needed) without changing entry/job keys.

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

```text
localChanged  = localHash  != syncedLocalHash
remoteChanged = remoteRev != syncedRemoteRev

if localChanged && remoteChanged -> Conflict
```

### 10.2 Default Resolution Strategy

- Keep one canonical editable file.
- Save the opposite-side version as a conflict copy:

```text
<filename> (conflicted <source> YYYY-MM-DD HHmm).<ext>
```

- `<source>` values: `local` / `remote`
- Persist result in index and mark conflict state.

### 10.3 Configurable Strategies

- `bidirectional` (default)
- `local_win`
- `remote_win`

---

## 11. Job Queue & Execution

### 11.1 Job Types

- `upload`
- `download`
- `delete-remote`
- `delete-local`
- `move-remote`
- `move-local`
- `create-remote-folder`
- `create-local-folder`

### 11.2 Execution Rules

- Serialize execution on same path.
- Prioritize move/delete over content jobs.
- Priority-aware scheduling (higher priority first).
- Concurrency cap: 2 (built-in, not configurable).
- All jobs must be **idempotent**.
- Queue state machine: pending / processing / blocked.
- Retry scheduling (`retryAt`) must be visible.

### 11.3 Retry Policy

- Network / 5xx: exponential backoff.
- Auth error: pause and require re-login.
- Error-class-specific backoff (rate/network/404, etc.).
- Exceeding max retries (built-in 5) -> `Error` state.

---

## 12. Startup & Recovery

### 12.1 Plugin Startup Flow

1. Load Index DB
2. Restore session
3. Quick local scan (mtime/size)
4. Pull remote changes
5. Reconcile -> enqueue jobs
6. Start workers

### 12.2 Crash Recovery

- Continue unfinished jobs.
- Keep tombstones to avoid repeated create/delete churn.
- Support "Rebuild Index" command.
- Cleanup stale processing jobs and orphaned state during startup.

---

## 13. UI & UX Requirements

### 13.1 Settings

- Account login/logout
- Remote Root selector
- Exclude rules (supports `*`/`**`, includes validation and preview)
- Conflict strategy
- Auto sync on/off

### 13.2 Status View

- Current state
- Queue length
- In-flight job + next retry time
- Last error
- Manual sync / pause / resume
- Conflict summary
- Recent logs

### 13.3 Commands

- Sync now
- Pause / Resume
- Rebuild index
- Export diagnostics
- Review conflicts

---

## 14. Performance Requirements

- Vault up to 50k files can start.
- Must not block Obsidian main thread.
- Lazy hash computation.
- Paginated remote traversal with provider/SDK-appropriate pacing.
- Pre-sync check (job count, size estimate, confirm/cancel).
- Background reconciliation + throttled scanning.

---

## 15. Observability

- Structured logs (no sensitive fields)
- Job-level error tracking
- Exportable diagnostics bundle (redacted)
- Log viewer (status view)
- Runtime metrics (duration, throughput, failure rate, queue peaks)

---

## 16. Risks & Mitigations

| Risk                            | Mitigation                            |
| ------------------------------- | ------------------------------------- |
| Remote provider SDK instability | Isolate with RemoteFS facade          |
| No remote cursor                | Snapshot diff + optimization          |
| Large vault performance         | Layered scanning + throttling         |
| External rename complexity      | Rename inference window (future)      |
| Cursor jitter                   | Persistent cursor + snapshot fallback |
| Mobile differences              | Degraded path + runtime detection     |

---

## 17. Milestones

### Phase 0 - Feasibility

- Validate SDK login + list/upload/download.

### Phase 1 - MVP

- Two-way sync (manual trigger).
- Index + job queue.
- Basic conflict handling.

### Phase 2 - GA

- Auto sync.
- Remote incremental processing.
- Complete recovery and diagnostics.

---

## 18. Open Questions

- Is there an official change feed / cursor?
- Can stronger remote change fingerprints be derived from SDK public APIs (etag/mtime/size combination)?

---

## 19. Runtime Refactor Plan (2026-03)

### 19.1 Goals

- Decouple plugin entrypoint from sync orchestration: keep `main.ts` as thin facade and move runtime logic to `runtime/*`.
- Preserve sync-kernel semantics: `reconciler + queue + executor` remain stable; no algorithm rewrite in this refactor.
- Improve testability: scheduler, session, and one-cycle execution should be independently testable.

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
    - `planner/*`: local/remote planning + reconciliation policies
    - `engine/*`: execution engine and queue
    - `state/*`: state store and in-memory index model
    - `support/*`: shared helpers
    - `use-cases/*`: provider-agnostic one-cycle sync execution
    - shared contracts live under `src/contracts/sync/*` and `src/contracts/filesystem/*`
    - keep conflict/retry/state semantics unchanged

- **Provider remote filesystem adapter boundary (`provider/providers/*`)**
    - provider-owned `RemoteFileSystem` adapters
    - no shared provider-side decorator/strategy layer by default
    - introduce a shared abstraction only after a concrete cross-provider need appears

### 19.3 Non-goals for this refactor

- Do not introduce new conflict strategies.
- Do not change job priority and retry semantics.
- Do not switch storage backend (stay on Dexie IndexedDB + plugin data settings).

### 19.4 Rollout phases

1. **Phase A (behavior-preserving split)**
    - extract orchestration from `main.ts` into `runtime/plugin-runtime.ts`
    - keep public plugin methods stable for UI/commands compatibility

2. **Phase B (orchestration boundaries)**
    - split session/scheduler/runner into dedicated runtime modules

3. **Phase C (resilience extensions)**
    - add `NetworkPolicy` runtime module (feature-flagged)
    - keep provider-specific IO behavior inside provider adapters unless a shared abstraction is justified

### 19.5 Acceptance criteria

- `pnpm run test` and `pnpm run build` pass after each phase.
- No regression in manual scenarios:
    - session restore
    - token refresh
    - pause/resume auto sync
    - local/remote rename synchronization

## 20. Remote Provider Abstraction Plan (2026-03)

### 20.1 Goals

- Unify remote file operations and auth/connect/scope validation under provider layer.
- Support future remote providers without changing sync-kernel algorithms.
- Keep default behavior unchanged (default provider remains `proton-drive`).

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
    - one-time migration from legacy brand-specific fields (`protonSession`, `remoteFolderId`, etc.) to provider fields on load
    - persist provider-only settings after migration (no dual-write compatibility fields)
    - remove legacy settings paths from runtime reads/writes

### 20.4 Rollout phases

1. **Phase A**
    - add provider contracts/registry and default remote provider implementation

2. **Phase B**
    - migrate runtime session/sync runner to provider interfaces

3. **Phase C**
    - migrate settings/login/commands/modals from direct provider services to provider APIs

4. **Phase D**
    - delete unused provider-specific helpers and keep provider use-cases as only sync entrypoints

### 20.5 Acceptance criteria

- Providerized runtime works with existing provider data/state.
- No behavior regression in login restore, token refresh, auto-sync, and manual sync.
- Lint/test/build remain green after each phase.

### 20.6 Implementation status (2026-03-06)

- Phase A/B/C completed (provider contracts/registry, runtime, settings/login/commands/modals).
- Added provider session helper to unify restore/refresh/connect session paths.
- Added `getRootScope(...)` in provider so remote folder selector no longer depends on concrete SDK details.
- Removed legacy dual-write settings compatibility path; now one-time migration then provider-only persistence.
- Verification result at that point: `pnpm run lint`, `pnpm run test`, and `pnpm run build` all passed.

---
