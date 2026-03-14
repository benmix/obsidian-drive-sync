# Obsidian Drive Sync Architecture

## 1. Purpose

This document describes the architecture of the current codebase. It answers four questions:

- how the repository is layered
- how sync work enters the runtime and reaches the sync kernel
- how provider-specific code is kept separate from provider-agnostic logic
- where new integrations or extensions should be added

For product scope and required behavior, read [`SPECS.md`](./SPECS.md). This file is about implementation ownership.

## 2. System Overview

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

## 3. Layer Responsibilities

### 3.1 Filesystem Contracts

Owned paths:

- `src/contracts/filesystem/*`
- `src/filesystem/path.ts`

Responsibilities:

- define shared IO contracts such as `LocalFileSystem`, `RemoteFileSystem`, and `LocalChange`
- define path utilities used across layers

Constraints:

- no runtime orchestration
- no provider-specific behavior
- no sync policy

### 3.2 Provider Layer

Owned path:

- `src/provider/*`

Responsibilities:

- expose provider-level abstractions such as `LocalProvider` and `RemoteProvider`
- isolate SDK and platform-specific behavior
- own concrete filesystem adapters
- own provider registry and provider selection

Current design notes:

- `default-registry.ts` builds the active provider registries
- remote providers return concrete `RemoteFileSystem` adapters directly
- there is no shared provider-side strategy or middleware layer in the current design

### 3.3 Sync Kernel

Owned path:

- `src/sync/*`

Responsibilities:

- `planner/*`: compare local and remote state and decide what work should happen
- `engine/*`: execute queued jobs, apply retries, and advance state
- `state/*`: persist sync state and queue data
- `use-cases/sync-runner.ts`: run one provider-agnostic sync cycle

Design rule:

- the sync kernel depends on shared contracts, not on provider SDKs or concrete providers

### 3.4 Runtime Layer

Owned path:

- `src/runtime/*`

Responsibilities:

- `plugin-state.ts`: load, normalize, persist, and expose provider-related settings and state
- `plugin-runtime.ts`: runtime composition root and plugin-facing orchestration API
- `session-manager.ts`: restore, refresh, and pause auth sessions
- `trigger-scheduler.ts`: own interval triggers, local debounce, and single-flight scheduling
- `sync-coordinator.ts`: build active filesystems and hand control to the sync runner
- `network-policy.ts`: optionally gate sync activity after network failures

Runtime is the only layer that should coordinate providers, sessions, policies, and the sync kernel in one place.

### 3.5 Plugin Facade, UI, And Commands

Owned paths:

- `src/main.ts`
- `src/ui/*`
- `src/commands/*`

Responsibilities:

- `main.ts`: plugin lifecycle entrypoint and thin facade over runtime and state
- `ui/*`: settings, modals, and user-facing views built on plugin-facing contracts
- `commands/*`: user-triggered command entrypoints

Rules:

- UI should not depend on concrete provider implementations
- commands should not reproduce sync or provider logic inline
- `main.ts` should wire components together, not own sync algorithms

## 4. Core Abstractions

### 4.1 `ObsidianDriveSyncPluginApi`

Location:

- `src/contracts/plugin/plugin-api.ts`

Purpose:

- give runtime, UI, and commands a stable shared interface
- prevent reverse dependencies on `main.ts` implementation detail

### 4.2 `RemoteProvider` And `LocalProvider`

Location:

- `src/contracts/provider/*`

Purpose:

- group auth, connectivity, scope handling, and filesystem creation under provider ownership
- keep the sync kernel focused on filesystem contracts instead of SDK-specific operations

### 4.3 Remote Filesystem Adapter Ownership

Location:

- `src/provider/providers/<provider>/remote-file-system.ts`

Purpose:

- keep remote IO behavior inside the provider adapter that owns it
- avoid extracting a shared provider-side abstraction until at least two providers need the same behavior

## 5. Main Runtime Sequences

### 5.1 Plugin Startup

1. `main.ts` creates plugin state and loads persisted settings.
2. State normalization or migration runs if required.
3. Provider registries are built from the active provider IDs.
4. `PluginRuntime` is created and attempts session restore.
5. Commands and settings UI are registered.
6. Scheduler state is refreshed according to the current settings.

### 5.2 Sync Execution

1. A command, UI action, interval, or local change requests a sync run.
2. `TriggerScheduler` ensures single-flight behavior.
3. `PluginRuntime` applies network policy and session checks.
4. `SyncCoordinator` creates the active local and remote filesystems.
5. `SyncRunner` applies local changes, polls remote changes, reconciles state, and runs the queue.
6. Sync state, jobs, logs, and metrics are persisted.

### 5.3 Auth Recovery

1. `SessionManager` reads stored credentials.
2. It asks the active provider to restore or refresh the session.
3. On success, reusable credentials are persisted and auth pause is cleared.
4. On failure, auth pause is entered and runtime-visible error state is updated.

## 6. Data And State

### 6.1 Settings

Storage:

- Obsidian plugin data via `loadData()` and `saveData()`

Examples of persisted settings:

- provider ID
- remote scope ID and path
- provider credentials and account summary
- sync strategy and auto-sync configuration
- network policy toggle

### 6.2 Sync State

Storage:

- IndexedDB via Dexie

Main tables:

- `entries`: path mapping, fingerprints, conflict flags, tombstones
- `jobs`: queued work, priority, retry state, and next run time
- `meta`: sync summary, cursor state, and runtime metrics
- `logs`: structured diagnostics

## 7. Dependency Direction

The repository enforces layer boundaries with `oxlint` and a custom layer check.

Key rules:

- `runtime/` must not depend on UI internals, command modules, `main.ts`, or concrete providers
- `provider/` must not depend on `runtime/` or `sync/`
- `sync/` must preserve its internal layering so planner, engine, and state concerns do not collapse together
- foundational filesystem contracts must not depend on upper business layers

## 8. Extension Guidance

### 8.1 Adding A New Remote Provider

1. Implement auth and remote filesystem logic under `provider/providers/<new-provider>/`.
2. Implement the `RemoteProvider` contract.
3. Register the provider in `default-registry.ts`.
4. Keep provider-specific behavior inside that provider unless another provider proves the same need.
5. Leave `sync/*` unchanged unless a shared contract must evolve.

### 8.2 Extracting Shared Provider Behavior

1. Start by implementing the behavior inside the provider that needs it.
2. Extract a shared abstraction only after at least two providers need the same thing.
3. Keep runtime and sync unaware of provider-specific mechanics.
4. Add tests around the extracted behavior before reusing it.

## 9. Architecture Decisions To Preserve

- Provider abstraction exists to keep SDK coupling out of the sync kernel.
- `main.ts` remains a facade, not the orchestration layer.
- Shared contracts live under `src/contracts/*`.
- Remote provider behavior stays in concrete provider adapters by default.
- Runtime coordinates sessions, policies, and sync; sync does not reach upward.

## 10. Future Evolution

- Keep settings naming provider-neutral.
- Allow the provider registry to grow beyond a single visible remote provider if the product needs it.
- Require a concrete second use case before introducing shared provider-side middleware.
- Add stronger architecture regression checks if layering starts drifting.
