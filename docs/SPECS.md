# Obsidian Drive Sync

## 1. Overview

### 1.1 Product Name

Obsidian Drive Sync Plugin

### 1.2 Purpose

Provide reliable two-way synchronization between one local Obsidian vault and one selected remote provider directory, with conflict detection, failure recovery, and enough observability to debug real sync problems.

### 1.3 Non-Goals

- replacing the native Obsidian vault adapter
- real-time multi-user collaboration
- a custom backend beyond the chosen remote provider APIs
- guaranteed consistency with Obsidian Sync

## 2. Scope

### 2.1 In Scope

- two-way sync between a local vault and one remote root
- file and folder create, modify, delete, and rename
- conflict detection and configurable resolution strategy
- session restore, retry, and resumable execution
- desktop platforms: macOS, Windows, Linux

### 2.2 Out Of Scope

- fully validated mobile auto-sync behavior
- rich-text or line-level merge; conflict handling stays file-level

## 3. Terms

| Term            | Meaning                                              |
| --------------- | ---------------------------------------------------- |
| Vault           | Local directory managed by Obsidian                  |
| Remote Root     | The selected remote directory used as the sync scope |
| relPath         | Normalized path relative to the vault root           |
| node uid        | Stable identifier of a remote node                   |
| Index           | Persisted sync state database                        |
| Job             | Idempotent sync task                                 |
| Synced Baseline | Last successful local and remote fingerprint pair    |

## 4. High-Level Architecture

### 4.1 Component Model

- UI layer
    - settings tab
    - sync status view
    - command palette commands
- Runtime orchestration
    - session restore and refresh
    - scheduler and trigger coordination
    - sync coordination
- Sync kernel
    - reconcile local and remote state
    - decide and run queue work
    - persist sync state
- Filesystem contracts layer
    - shared contracts for `LocalFileSystem`, `RemoteFileSystem`, and `LocalChange`
- Local filesystem adapter
    - built on Obsidian vault APIs
    - owns local event stream and file operations
- Remote filesystem adapter
    - owns remote provider SDK interaction
    - exposes a stable remote filesystem abstraction
- Persistence layer
    - plugin settings in Obsidian plugin data
    - sync state in IndexedDB via Dexie

## 5. Authentication And Session

### 5.1 Authentication Model

- auth uses the remote provider account and SDK session mechanism
- login uses username and password plus optional 2FA or mailbox-password flows
- plaintext passwords are not persisted by the plugin

### 5.2 Session Persistence

Persisted payload:

- opaque session credentials managed by the provider integration layer

Lifecycle:

1. plugin starts and attempts session restore
2. expired or invalid session triggers re-auth flow
3. unrecoverable failure pauses sync and requests user action

### 5.3 Security Requirements

- do not log sensitive auth fields
- support explicit sign-out and session clearing
- stop sync work when session validation fails

### 5.4 SDK Client Bootstrapping Requirements

The current provider integration requires:

- `httpClient`: fetch adapter with auth headers, timeout, refresh, and retry behavior
- `account`: provider account interface for decryption-related capabilities
- `crypto`: OpenPGP and crypto wrapper used by the SDK
- `srp`: SRP support for login and session handling
- `cache`: memory caches used by the SDK
- `telemetry`: adapter that routes SDK telemetry into plugin logging without sensitive fields

## 6. Local Filesystem Requirements

### 6.1 Event Sources

The local adapter must handle Obsidian vault events for:

- `create`
- `modify`
- `delete`
- `rename(oldPath, newPath)`

### 6.2 Event Normalization

The adapter must:

- normalize path separators to `/`
- remove `.` and `..`
- apply one consistent case strategy

### 6.3 Event Debounce

- same-path merge window should stay around 300 ms to 800 ms
- rename should take priority over create and delete churn

## 7. Remote Filesystem Requirements

### 7.1 Remote Root

- sync scope is limited to one user-selected remote root
- the plugin must not operate outside that scope

### 7.2 Required Remote Capabilities

The remote adapter must support:

- tree listing with pagination
- upload for create and update
- download
- delete
- move or rename
- stable remote identifiers
- at least one revision fingerprint such as revision ID, etag, or `mtime`

### 7.3 Remote Change Detection

- preferred: cursor or change-feed support
- fallback: periodic snapshot diff

## 8. Persistence Requirements

### 8.1 `entries` Table

| Field             | Type    | Notes                       |
| ----------------- | ------- | --------------------------- |
| `relPath`         | TEXT PK | normalized path             |
| `type`            | ENUM    | `file` or `folder`          |
| `localMtimeMs`    | INTEGER | local timestamp             |
| `localSize`       | INTEGER | local size                  |
| `localHash`       | TEXT    | lazy sha256                 |
| `remoteId`        | TEXT    | node uid                    |
| `remoteRev`       | TEXT    | remote revision fingerprint |
| `syncedLocalHash` | TEXT    | baseline                    |
| `syncedRemoteRev` | TEXT    | baseline                    |
| `tombstone`       | BOOLEAN | deletion marker             |
| `lastSyncAt`      | INTEGER | last success time           |

### 8.2 `jobs` Table

| Field       | Type    |
| ----------- | ------- |
| `id`        | TEXT PK |
| `op`        | ENUM    |
| `path`      | TEXT    |
| `fromPath`  | TEXT    |
| `toPath`    | TEXT    |
| `priority`  | INTEGER |
| `attempt`   | INTEGER |
| `nextRunAt` | INTEGER |
| `reason`    | ENUM    |

### 8.3 Storage Backend

- plugin settings remain in Obsidian plugin data
- sync state lives in IndexedDB via Dexie
- schema changes are managed through Dexie versioning

### 8.4 Migration Rules

- each schema change increments `SYNC_STATE_DB_VERSION`
- use Dexie migration hooks when data transformation is needed
- preserve a backward-compatible read path for one release when practical
- for breaking changes, provide a rebuild path with user-visible warning
- avoid silent data loss during migration

## 9. Sync State Model

### 9.1 Path-Level States

Representative path-level states:

- `Clean`
- `LocalDirty`
- `RemoteDirty`
- `Conflict`
- `Syncing`
- `Error`

### 9.2 Simplified Transitions

| From          | Event             | To            |
| ------------- | ----------------- | ------------- |
| `Clean`       | local modify      | `LocalDirty`  |
| `Clean`       | remote change     | `RemoteDirty` |
| `LocalDirty`  | upload success    | `Clean`       |
| `RemoteDirty` | download success  | `Clean`       |
| any           | conflict detected | `Conflict`    |
| any           | fatal error       | `Error`       |

## 10. Conflict Detection And Resolution

### 10.1 Detection Rule

```text
localChanged  = localHash  != syncedLocalHash
remoteChanged = remoteRev != syncedRemoteRev

if localChanged && remoteChanged -> conflict
```

### 10.2 Default Resolution Model

- keep one canonical editable file
- save the opposite-side version as a conflict copy
- mark the path as conflict state in the index

Conflict copy naming:

```text
<filename> (conflicted <source> YYYY-MM-DD HHmm).<ext>
```

Allowed source values:

- `local`
- `remote`

### 10.3 Supported Strategy Values

- `bidirectional`
- `local_win`
- `remote_win`

## 11. Job Queue And Execution

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

- serialize execution for the same path
- prioritize move and delete work ahead of ordinary content work when ordering matters
- use priority-aware scheduling
- current built-in concurrency cap is 2
- all jobs must be idempotent
- queue state supports `pending`, `processing`, and `blocked`
- retry timing must be visible in persisted state or UI

### 11.3 Retry Policy

- network and transient server failures use exponential backoff
- auth failures pause sync and require user action
- retry behavior may vary by error class
- exceeding the built-in max retry count moves the job into failure state

## 12. Startup And Recovery

### 12.1 Plugin Startup Flow

1. load sync state
2. restore auth session
3. perform quick local scan
4. pull remote changes
5. reconcile state and enqueue work
6. start queue execution

### 12.2 Crash Recovery

- resume unfinished jobs
- keep tombstones to avoid repeated create or delete churn
- support index rebuild as an explicit recovery action
- clean stale processing jobs and orphaned state during startup

## 13. UI And UX Requirements

### 13.1 Settings

The settings UI must expose at least:

- account login and logout
- remote root selection
- exclude rules with validation and preview
- sync strategy
- auto-sync toggle

### 13.2 Status View

The status view must expose at least:

- current sync state
- queue length and job counts
- in-flight work and next retry time when relevant
- last error summary
- manual sync and pause or resume actions
- conflict summary
- recent logs

### 13.3 Commands

The command set must support at least:

- sync now
- pause or resume auto-sync
- rebuild index
- export diagnostics
- review conflicts

## 14. Performance Requirements

- startup should remain practical for large vaults, including vaults around 50k files
- the plugin must avoid blocking the Obsidian main thread
- hashing should stay lazy where possible
- remote traversal should be paginated and paced appropriately for the provider
- pre-sync checks should estimate work before destructive or expensive runs
- background reconciliation should be throttled

## 15. Observability Requirements

- structured logs with no sensitive fields
- job-level error tracking
- exportable diagnostics bundle with redaction
- in-app log viewer
- runtime metrics such as duration, throughput, failure rate, and queue peaks

## 16. Risks And Mitigations

| Risk                     | Mitigation                                        |
| ------------------------ | ------------------------------------------------- |
| provider SDK instability | isolate it behind the remote adapter              |
| no remote cursor support | use snapshot diff with optimization               |
| large-vault performance  | use lazy hashing, batching, and throttling        |
| rename complexity        | keep rename handling explicit and test edge cases |
| cursor jitter            | persist cursor and fall back to snapshot diff     |
| mobile differences       | treat mobile as degraded support until verified   |

## 17. Milestones

### Phase 0: Feasibility

- validate login, listing, upload, and download through the provider SDK

### Phase 1: MVP

- manual two-way sync
- index and job queue
- baseline conflict handling

### Phase 2: GA

- auto-sync
- remote incremental processing
- stronger recovery and diagnostics

## 18. Open Questions

- whether the provider exposes an official change feed or cursor in every required environment
- whether stronger remote fingerprints can be derived from public SDK data alone

## 19. Runtime Refactor Plan (2026-03)

### 19.1 Goals

- keep `main.ts` thin and move orchestration into `runtime/*`
- preserve sync-kernel semantics while improving ownership clarity
- make scheduler, session, and one-cycle sync behavior easier to test

### 19.2 Target Layering

- plugin facade in `main.ts`
- runtime orchestration in `runtime/*`
- provider-agnostic sync kernel in `sync/*`
- provider-owned filesystem adapters in `provider/providers/*`
- shared contracts in `src/contracts/*`

### 19.3 Non-Goals

- no new conflict strategies
- no retry-semantics rewrite
- no storage-backend change away from Dexie and plugin data

### 19.4 Rollout Phases

1. extract orchestration from `main.ts`
2. split session, scheduler, and coordinator ownership
3. add optional network policy

### 19.5 Acceptance Criteria

- `pnpm run test` and `pnpm run build` pass after each phase
- no regression in session restore, token refresh, pause or resume, and rename scenarios

## 20. Remote Provider Abstraction Plan (2026-03)

### 20.1 Goals

- unify auth, connect, scope validation, and remote filesystem creation under provider ownership
- support future providers without changing sync-kernel algorithms
- keep existing default behavior with `proton-drive`

### 20.2 Main Abstractions

- `RemoteProvider`
    - login, restore, refresh, logout
    - connect and disconnect
    - create remote filesystem
    - validate scope
- `LocalProvider`
    - create local filesystem
    - create local watcher
- provider registries for local and remote providers

### 20.3 Settings Model Evolution

Provider-oriented settings fields include:

- `remoteProviderId`
- `remoteScopeId`
- `remoteScopePath`
- `remoteProviderCredentials`
- `remoteAccountEmail`
- `remoteHasAuthSession`

Compatibility direction:

- persist provider-oriented fields directly
- keep runtime reads and writes on the provider fields only
- do not keep old brand-specific compatibility paths alive indefinitely

### 20.4 Rollout Phases

1. add provider contracts and registry
2. migrate runtime session and sync entrypoints onto provider interfaces
3. migrate settings, login, commands, and modal flows onto provider APIs
4. remove obsolete direct-provider helper paths

### 20.5 Acceptance Criteria

- providerized runtime still works with existing state and settings
- no regression in login restore, token refresh, auto-sync, and manual sync
- lint, test, and build remain green

### 20.6 Implementation Status (2026-03-06)

- phases A, B, and C completed
- provider session helper added to unify restore, refresh, and connect paths
- provider root-scope API added so remote-folder selection no longer depends on SDK details in UI code
- legacy settings compatibility path removed
- at that milestone, `pnpm run lint`, `pnpm run test`, and `pnpm run build` all passed
