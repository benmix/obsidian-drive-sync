# Tasks

This file tracks notable completed work and the most visible remaining gaps. It is not a full project-management system. Its purpose is to keep repository-level priorities visible next to the code.

## Feasibility And SDK Research

### SDK Client Bootstrapping

- [x] Define SDK initialization requirements: `httpClient`, `account`, `crypto`, `srp`, `cache`, `telemetry`.
- [x] Build the internal `httpClient` adapter with auth headers and refresh handling.
- [x] Refactor remote provider service construction so users no longer supply raw SDK JSON.

### Authentication And Session Lifecycle

- [x] Implement login, persist, restore, refresh, and logout.
- [x] Validate login flow with the injected `httpClient`.
- [x] Add auth UX for login, ready state, and logout.
- [x] Remove obsolete SDK JSON input from settings and show auth status instead.
- [x] Add redacted auth diagnostics and logging.

### Remote Operations Validation

- [x] Verify `list`, `create`, `upload`, `download`, `delete`, and `move` inside a scoped remote root.
- [x] Confirm node `uid` stability across rename, move, and new revision uploads.
- [x] Collect remote metadata for change detection.

### Documentation

- [x] Document verification steps for login, CRUD validation, and UID stability.

## Core Sync

- [x] Implement the local filesystem adapter over Obsidian vault events and snapshot reads.
- [x] Implement the remote filesystem adapter using public SDK APIs.
- [x] Build the Dexie-backed index and job queue.
- [x] Build reconciliation and idempotent queue execution.
- [x] Add a one-shot manual sync command.
- [x] Handle incremental local changes with debounce and rename support.
- [x] Add remote snapshot diff polling.
- [x] Add remote cursor or feed support with snapshot fallback.
- [x] Add conflict detection and default conflict-copy behavior.
- [x] Add a status view for queue state, pause or resume, errors, and logs.

## Reliability And Recovery

- [x] Add retry policy with backoff and auth pause.
- [x] Add priority-aware scheduling and retry caps.
- [x] Persist auth-pause state and surface it in the UI.
- [x] Support crash recovery and resumable queue work.
- [x] Add queue states for pending, processing, and blocked jobs.
- [x] Persist and reuse remote event cursors.
- [x] Add background reconciliation with throttled scanning and skip-on-busy behavior.
- [x] Handle rename and parent-change edge cases.
- [x] Clean up stale processing jobs and orphaned state on startup.
- [x] Differentiate retry policy by error class.
- [x] Surface pending, processing, and blocked counts in the status view.

## Performance

- [x] Improve large-vault behavior through lazy hashing, batching, and throttling.
- [x] Add `mtime + size` change tokens to reduce hash work.

## UX And UI

- [x] Replace manual folder ID input with a remote root selector.
- [x] Add manual conflict review and resolution flow.
- [x] Expand conflict review options to keep local, keep remote, and resume sync.
- [x] Add pre-sync checks with job counts, size estimates, and confirmation.
- [x] Improve queue visibility and retry timing in the UI.
- [x] Validate remote-folder settings input.

## Observability

- [x] Add structured logs and an in-app log viewer.
- [x] Export diagnostics with state and settings summaries.
- [x] Define redaction rules and privacy review boundaries.
- [x] Add runtime metrics such as duration, throughput, failures, and queue peaks.

## Data And Storage

- [x] Persist plugin settings through `loadData()` and `saveData()`.
- [x] Move sync state to Dexie-backed IndexedDB.
- [x] Replace localStorage-based sync state.
- [x] Plan schema migration rules for future changes.

## Testing And Compatibility

- [ ] Validate mobile compatibility with runtime checks and UX review.
- [x] Add unit tests for the reconciler, queue, and exclude rules.
- [ ] Add stronger adapter-level unit tests.

## Runtime Architecture Refactor

### Phase A: Behavior-Preserving Split

- [x] Move auto-sync, session, and scheduler orchestration out of `main.ts` into `runtime/plugin-runtime.ts`.
- [x] Keep `main.ts` as a thin plugin facade.
- [x] Preserve plugin methods used by UI and commands.

### Phase B: Orchestration Boundaries

- [x] Add `runtime/session-manager.ts` for auth restore and refresh.
- [x] Add `runtime/trigger-scheduler.ts` for interval, debounce, and single-flight behavior.
- [x] Split execution between `runtime/sync-coordinator.ts` and `sync/use-cases/sync-runner.ts`.

### Phase C: Resilience Extension Points

- [x] Add optional `runtime/network-policy.ts`.

### Phase D: Sync Module Layout Hygiene

- [x] Reorganize `sync/` by responsibility.
- [x] Move manual-sync and diagnostics orchestration into `runtime/use-cases/`.
- [x] Update import boundaries and tests without changing behavior.
- [x] Add `oxlint` guards for sync-layer dependency direction.

### Verification

- [x] `pnpm run test` passed after each phase.
- [x] `pnpm run build` passed after each phase.
- [ ] Manual checks still pending for session restore, token refresh, pause or resume, and local or remote rename flows.

## Remote Provider Abstraction

### Phase A: Provider Foundation

- [x] Add `RemoteProvider` contracts and registries.
- [x] Add the default remote provider implementation for `proton-drive`.
- [x] Add `LocalProvider` abstraction and the Obsidian local provider.
- [x] Add `LocalProviderRegistry` bootstrap.
- [x] Add provider-oriented settings fields.

### Phase B: Runtime Integration

- [x] Refactor `SessionManager` to restore, refresh, and connect through provider interfaces.
- [x] Refactor `SyncRunner` to create the remote filesystem through the provider.

### Phase C: UI And Command Migration

- [x] Move login and settings auth flows onto the provider interface.
- [x] Move command handlers and modal flows away from direct provider service usage.

### Verification

- [x] `pnpm run lint` passed after provider changes.
- [x] `pnpm run test` passed after provider changes.
- [x] `pnpm run build` passed after provider changes.
- [x] Remove the legacy settings migration path and persist provider-only fields directly.

## Filesystem Contract Extraction

- [x] Extract shared filesystem contracts into `src/contracts/filesystem/*`.
- [x] Migrate provider imports to the new filesystem contracts.
- [x] Migrate sync, runtime, UI, and test imports that depended on the old location.
- [x] Keep sync-run contracts under `src/contracts/sync/*`.
- [x] Add lint boundaries so `provider/` cannot import `sync/**` and foundational filesystem code stays dependency-light.
- [x] Verify with `pnpm run lint`, `pnpm run test`, and `pnpm run build`.

## Remote Rate Limiting Evolution

- [x] Document and prototype provider-owned remote rate limiting.
- [x] Re-evaluate the maintenance cost of an extra provider-side strategy layer.
- [x] Remove the unused provider-side rate-limit strategy and related tests and contracts from the current codebase.
