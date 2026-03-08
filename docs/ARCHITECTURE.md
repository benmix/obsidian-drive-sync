# Obsidian Drive Sync Architecture Design

## 1. Document Objectives

This document describes the architecture that corresponds to the current codebase implementation, focusing on the following questions:

- How modules are layered and where boundaries are defined.
- How the sync flow enters from UI/commands and is eventually executed.
- How Provider and Sync Kernel are decoupled.
- Where future extensions (new providers / new strategies) should be implemented.

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

## 3. Layers and Responsibilities

### 3.1 Filesystem Contracts (Shared Foundational Contracts)

- Directory: `src/filesystem/*`
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
    - `strategy/*` provides provider-side pluggable strategy chains.

### 3.3 Sync Kernel

- Directory: `src/sync/*`
- Responsibilities:
    - `planner/*`: change detection and reconciliation planning (local/remote/reconcile).
    - `engine/*`: queue execution, retry, and state progression.
    - `state/*`: sync state persistence abstraction.
    - `use-cases/sync-runner.ts`: entry point for one sync cycle.
- Design principle:
    - Provider-agnostic; depends only on `filesystem/contracts` abstractions.

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

- Location: `src/plugin/contracts.ts`
- Purpose:
    - A shared interface for Runtime/UI/Commands, preventing reverse dependency on `main.ts` implementation details.

### 4.2 `RemoteProvider` / `LocalProvider`

- Location: `src/provider/contracts/`
- Purpose:
    - Consolidate auth, connectivity, scope handling, and file system creation into providers.
    - Keep Sync Kernel focused on `RemoteFileSystem` / `LocalFileSystem` without SDK awareness.

### 4.3 RemoteFileSystem Strategy Chain

- Locations:
    - `src/provider/strategy/contracts.ts`
    - `src/provider/strategy/*`
- Purpose:
    - Compose cross-provider reusable strategies within providers (for example, rate limiting).
    - Runtime does not inject strategies and does not expose external strategy toggles.

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
    - Creates remote file system from `RemoteProvider` (including provider-internal strategy chain).
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
4. Reuse shared strategies from `provider/strategy/*` as needed.
5. Keep `sync/*` unchanged; if needed, only add provider-specific UX text in UI.

### 8.2 Add a New RemoteFileSystem Strategy

Recommended steps:

1. Create a strategy implementation under `provider/strategy/`.
2. Keep input/output as `RemoteFileSystem -> RemoteFileSystem`.
3. Inject strategy in the target provider’s `createRemoteFileSystem`.
4. Add standalone unit tests for the strategy to avoid affecting sync kernel tests.

## 9. Architecture Decision Summary

- Uses layered "Provider Abstraction + Sync Kernel" to reduce SDK coupling.
- Uses `main.ts` as facade with runtime orchestration to avoid entrypoint bloat.
- Moves path/filesystem foundational capability to `filesystem` to avoid cross-layer utility leakage.
- Uses provider-owned strategy chain for remote rate limiting to avoid external configuration drift.

## 10. Future Evolution Suggestions

- `DriveSyncSettings` has been renamed to be provider-neutral; keep this neutral semantic direction.
- Evolve provider registry to support multiple providers visible in parallel (current model is active-ID scoped registration).
- Add strategy-chain runtime metrics (wait time, hit counts, error category distribution).
- Add architecture regression checks (for example, automatic import-graph boundary validation).
