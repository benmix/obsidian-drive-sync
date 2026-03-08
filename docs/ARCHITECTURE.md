# Obsidian Drive Sync Architecture Design

## 1. Document Objectives

This document describes the architecture that corresponds to the current codebase implementation, focusing on the following questions:

- How modules are layered and where boundaries are defined.
- How the sync flow enters from UI/commands and is eventually executed.
- How Provider and Sync Kernel are decoupled.
- Where future extensions (new providers / provider-specific behavior) should be implemented.

This is an implementation-oriented engineering document and does not repeat product requirement details. For product scope and functional specification, see `docs/SPECS.md`.

## 2. Architecture Overview

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

## 3. Layers and Responsibilities

### 3.1 Filesystem Contracts (Shared Foundational Contracts)

- Directories:
    - `src/contracts/filesystem/*`
    - `src/filesystem/path.ts`
- Responsibilities:
    - Define shared IO contracts such as `LocalFileSystem`, `RemoteFileSystem`, and `LocalChange`.
    - Provide path utilities (`path.ts`) as reusable cross-layer primitives.
- Constraints:
    - Types and foundational utilities only; no business workflow logic.

### 3.2 Provider Layer (External System Integration)

- Directory: `src/provider/*`
- Responsibilities:
    - Provide unified local/remote abstractions (`LocalProvider` / `RemoteProvider`).
    - Manage active providers via registry.
    - Isolate SDK and platform API differences.
- Key points:
    - `default-registry.ts` registers only the providers needed for the active ID.
    - Remote providers return concrete `RemoteFileSystem` adapters directly.
    - No shared provider-side strategy or middleware layer is currently enabled.

### 3.3 Sync Kernel

- Directory: `src/sync/*`
- Responsibilities:
    - `planner/*`: change detection and reconciliation planning (local/remote/reconcile).
    - `engine/*`: queue execution, retry, and state progression.
    - `state/*`: sync state persistence abstraction.
    - `use-cases/sync-runner.ts`: entry point for one sync cycle.
- Design principle:
    - Provider-agnostic; depends only on shared contracts under `src/contracts/*`.

### 3.4 Runtime Layer (Orchestration)

- Directory: `src/runtime/*`
- Responsibilities:
    - `plugin-runtime.ts`: lifecycle orchestration hub.
    - `session-manager.ts`: session restore/refresh and auth-pause control.
    - `trigger-scheduler.ts`: interval + local change debounce + single-flight.
    - `sync-coordinator.ts`: compose local/remote file systems and call `SyncRunner`.
    - `network-policy.ts`: network gate and failure cooldown (feature-toggleable).

### 3.5 Plugin Facade / UI / Commands (Outer Interaction Layer)

- `main.ts`
    - Plugin entry facade responsible for loading/migrating/saving settings, initializing registries, attaching runtime, and registering UI/commands.
- `ui/*`
    - Depend only on plugin API and provider abstractions; do not depend on concrete provider implementations.
- `commands/*`
    - Trigger runtime use-cases without coupling to concrete SDK internals.

## 4. Core Abstractions

### 4.1 `ObsidianDriveSyncPluginApi`

- Location: `src/contracts/plugin/plugin-api.ts`
- Purpose:
    - A shared interface for Runtime/UI/Commands, preventing reverse dependency on `main.ts` implementation details.

### 4.2 `RemoteProvider` / `LocalProvider`

- Location: `src/contracts/provider/`
- Purpose:
    - Consolidate auth, connectivity, scope handling, and file system creation into providers.
    - Keep Sync Kernel focused on `RemoteFileSystem` / `LocalFileSystem` without SDK awareness.

### 4.3 `RemoteFileSystem` Adapter Ownership

- Location:
    - `src/provider/providers/<provider>/remote-file-system.ts`
- Purpose:
    - Keep provider-specific remote IO behavior inside the provider adapter itself.
    - Avoid keeping an extra abstraction layer unless at least two providers need the same cross-provider behavior.

## 5. Key Sequences

### 5.1 Plugin Startup Sequence

1. `main.ts` reads plugin data.
2. Settings migration runs and normalized settings are persisted.
3. Local/remote registries are built by active provider ID.
4. `PluginRuntime` is initialized and `restoreSession()` is executed.
5. Setting tab and commands are registered.
6. Scheduler refresh is performed according to `autoSyncEnabled`.

### 5.2 Auto-Sync Sequence

1. `TriggerScheduler` emits a run request (`interval` / `local` / `manual`).
2. `PluginRuntime` evaluates `NetworkPolicy` first.
3. `SyncCoordinator`:
    - Builds active remote client via `SessionManager`.
    - Creates local file system from `LocalProvider`.
    - Creates remote file system from `RemoteProvider`.
4. `SyncRunner` executes:
    - Apply local change plan.
    - Poll remote changes and generate jobs.
    - Run full reconcile when needed.
    - Drive `SyncEngine.runOnce()` to consume queue and persist state.

### 5.3 Auth Recovery Sequence

1. At startup or manual trigger, `SessionManager` checks stored credentials.
2. It calls provider `restore/refresh`; on success it writes reusable credentials and clears auth pause.
3. On failure, it enters auth pause, blocks auto-sync, and records error context.

## 6. Data and State

### 6.1 Settings (Plugin Settings)

- Storage: Obsidian `loadData/saveData` (`data/plugin-data.ts`).
- Main fields:
    - provider ID, scope ID/path, credentials, account info, conflict strategy, auto-sync switch, network policy switch.

### 6.2 Sync State

- Storage: IndexedDB Dexie (`data/sync-db.ts`).
- Main tables:
    - `entries`: path state, remote mapping, baseline fingerprint, conflict markers.
    - `jobs`: queued operations, priority, retry, next run time, status.
    - `meta`: `lastSyncAt`, `lastError`, `remoteEventCursor`, runtime metrics.
    - `logs`: diagnostic logs.

## 7. Dependency Direction and Constraints

The repository enforces module boundaries with `oxlint no-restricted-imports` (see `.oxlintrc.json`).

Key constraints:

- `runtime` must not depend on UI, commands, concrete provider implementations, `main`, or settings UI.
- `provider` must not depend on sync/runtime/UI/commands/main/settings.
- `sync` internal import directions are constrained by sub-layer to keep kernel stable.
- `filesystem` as a foundational module must not depend on upper business layers.

## 8. Extension Design

### 8.1 Add a New Remote Provider

Recommended steps:

1. Implement auth and remote file system adapter in `provider/providers/<new-provider>/`.
2. Implement the `RemoteProvider` contract.
3. Add a provider factory mapping in `default-registry.ts`.
4. Keep provider-specific remote behavior inside the provider adapter unless there is a proven shared need.
5. Keep `sync/*` unchanged; if needed, only add provider-specific UX text in UI.

### 8.2 Add Shared Provider-Side Behavior

Recommended steps:

1. First implement behavior directly in the target provider adapter and confirm it is genuinely cross-provider.
2. Only introduce a shared provider-side abstraction after at least two providers need the same behavior.
3. Keep the sync kernel and runtime unaware of provider-specific mechanics.
4. Add standalone unit tests around the extracted provider behavior before reusing it elsewhere.

## 9. Architecture Decision Summary

- Uses layered "Provider Abstraction + Sync Kernel" to reduce SDK coupling.
- Uses `main.ts` as facade with runtime orchestration to avoid entrypoint bloat.
- Centralizes contracts under `src/contracts/*` and keeps path utilities separate in `src/filesystem/path.ts`.
- Keeps remote provider behavior in concrete provider adapters instead of maintaining an extra strategy layer by default.

## 10. Future Evolution Suggestions

- `DriveSyncSettings` has been renamed to be provider-neutral; keep this neutral semantic direction.
- Evolve provider registry to support multiple providers visible in parallel (current model is active-ID scoped registration).
- If shared provider-side behavior returns in the future, require a concrete second provider use case before extracting a new abstraction.
- Add architecture regression checks (for example, automatic import-graph boundary validation).
