# Tasks

## Feasibility and SDK research

### SDK client bootstrapping

- [x] Define SDK initialization requirements (httpClient/account/crypto/srp/cache/telemetry).
- [x] Build internal httpClient adapter with auth headers and refresh handling.
- [x] Refactor ProtonDriveService to construct client internally (no user SDK JSON).

### Authentication and session lifecycle

- [x] Implement session lifecycle (login, persist, restore, refresh, logout).
- [x] Validate login flow with injected `httpClient`.
- [x] Add auth flow UX (login modal -> ready state -> logout).
- [x] Update settings UI to remove SDK JSON input and show auth status.
- [x] Update auth diagnostics and logging (redacted).

### Remote operations validation

- [x] Verify `list`, `create`, `upload`, `download`, `delete`, `move` on a scoped Remote Root.
- [x] Confirm node `uid` stability across rename/move and new revision uploads.
- [x] Collect remote metadata for change detection (`activeRevision.uid`, `modificationTime`, `storageSize`).

### Documentation

- [x] Document verification steps for login/CRUD/uid stability.

## Core sync

- [x] Implement LocalFS adapter (Obsidian vault events + snapshot).
- [x] Implement RemoteFS adapter using SDK public API only.
- [x] Build Index DB (entries + jobs) with Dexie-backed IndexedDB.
- [x] Build reconciler and job queue with idempotent ops.
- [x] Manual sync command: one-shot reconcile + execute queue.
- [x] Incremental local changes (debounce + rename handling).
- [x] Remote polling snapshot diff (no official cursor).
- [x] Remote change cursor/feed support with snapshot fallback.
- [x] Conflict detection and default resolution (local wins + conflicted copy).
- [x] Health & status view (queue size, last error, pause/resume, logs).

## Reliability and recovery

- [x] Retry policy with backoff and auth pause.
- [x] Priority-aware scheduling and max retry caps.
- [x] Auth error pause and status reporting.
- [x] Crash recovery and resume (tombstones, pending jobs).
- [x] Queue state machine with retry scheduling (pending/processing/blocked).
- [x] Persist and reuse remote event cursors (avoid short polling sleep).
- [x] Background reconciliation pass with throttled scanning and skip-on-busy.
- [x] Rename/parent-change edge cases (conflicts, ordering).
- [x] Startup cleanup for stale processing jobs and orphaned state.
- [x] Refine retry policy by error class (auth/rate/network/404).
- [x] Add background reconciliation pass with throttled scanning and skip-on-busy (15m cadence in auto sync).
- [x] Surface job state counts in status view (pending/processing/blocked).

## Performance

- [x] Optimize large-vault performance (hash laziness, batching, throttling).
- [x] Introduce mtime+size change tokens to reduce hash cost.

## UX and UI

- [x] Build a remote root selector UI instead of manual folder ID input.
- [x] Implement a manual conflict resolution UI/flow.
- [x] Expand manual conflict resolution UI (keep local/remote, resume).
- [x] Add pre-sync checks (job counts, size estimates, confirm/abort).
- [x] Improve sync visibility (queue details, in-flight job, retry schedule).
- [x] Validate settings inputs (remote folder selection).

## Observability

- [x] Add structured logs and a log viewer in UI.
- [x] Diagnostics export with state and settings summary.
- [x] Define diagnostics redaction rules and privacy review.
- [x] Add runtime diagnostics (duration, throughput, failures, queue peaks).

## Data and storage

- [x] Data persistence via `loadData/saveData`.
- [x] IndexedDB via Dexie for sync state (no migration needed pre-release).
- [x] Replace localStorage sync state with IndexedDB via Dexie.
- [x] Plan IndexedDB schema migrations for future changes.

## Testing and compatibility

- [ ] Validate mobile compatibility (runtime tests + UX polish).
- [x] Add unit tests for reconciler, job queue, exclude rules.
- [ ] Add unit tests for adapters.

## Runtime architecture refactor

### Phase A - behavior-preserving split

- [x] Move auto-sync/session/scheduler orchestration from `main.ts` into `runtime/plugin-runtime.ts`.
- [x] Keep `main.ts` as plugin facade (load/save settings, UI registration, command registration).
- [x] Preserve existing external plugin methods used by UI/commands (`runAutoSync`, `pauseAutoSync`, `resumeAutoSync`, `isSyncRunning`, auth pause status).

### Phase B - orchestration boundaries

- [x] Introduce `runtime/session-manager.ts` for restore/refresh/persist auth session logic.
- [x] Introduce `runtime/trigger-scheduler.ts` for interval/debounce/pending single-flight scheduling.
- [x] Split sync execution into `runtime/sync-coordinator.ts` (runtime orchestration) and `sync/use-cases/sync-runner.ts` (provider-agnostic one-cycle pipeline).

### Phase C - resilience extension points

- [x] Add provider-scoped `RateLimitedRemoteFileSystem` strategy chain (`provider/remote-file-system/strategies/*`).
- [x] Add optional `runtime/network-policy.ts` to centralize network gating decisions.

### Phase D - sync module layout hygiene

- [x] Reorganize `sync/` by responsibility: `contracts/`, `planner/`, `engine/`, `state/`, `support/`, `use-cases/`.
- [x] Move use-case orchestration (`manual-sync`, `diagnostics`) into `runtime/use-cases/`.
- [x] Keep behavior unchanged while updating all import boundaries and tests/build.
- [x] Add `oxlint` import boundary guards (`no-restricted-imports` overrides) for sync layering.

### Verification

- [x] `pnpm run test` passes after each phase.
- [x] `pnpm run build` passes with no new type-unsafe bypasses.
- [ ] Manual checks: login restore, token refresh, pause/resume, local rename sync, remote rename sync.

## Remote provider abstraction

### Phase A - provider foundation

- [x] Add `RemoteProvider` contracts and registry.
- [x] Add Proton provider implementation over existing auth/service/remote-file-system.
- [x] Add `LocalProvider` abstraction and Obsidian local provider implementation (`local-file-system` + watcher).
- [x] Add `LocalProviderRegistry` and local provider bootstrap (`createLocalProviderRegistry`).
- [x] Add provider-aware settings fields (`remoteProviderId`, `remoteScope*`, `remoteProviderCredentials`).

### Phase B - runtime integration

- [x] Refactor `SessionManager` to restore/refresh/connect via provider abstraction.
- [x] Refactor `SyncRunner` to create remote file system via provider (`provider.createRemoteFileSystem(...)`).

### Phase C - UI and command migration

- [x] Migrate login/settings auth flows to provider interface (keep current Proton UX).
- [x] Migrate command handlers and conflict/remote-root modals off direct Proton service usage.

### Verification

- [x] `pnpm run lint` passes with provider changes.
- [x] `pnpm run test` and `pnpm run build` pass with provider changes.
- [x] One-time legacy settings migration on load, then persist provider-only settings.

## Filesystem contract extraction

- [x] Extract shared file-system contracts from `sync/contracts/types.ts` into `src/filesystem/contracts.ts`.
- [x] Migrate `provider/` imports from `sync/contracts` to `filesystem/contracts`.
- [x] Migrate `sync/runtime/ui/tests` imports for file-system types to `filesystem/contracts`.
- [x] Keep `sync/contracts/types.ts` focused on sync-run contracts (`SyncRunTrigger` / `SyncRunRequest`).
- [x] Add lint boundaries to enforce `provider` cannot import `sync/**` and `filesystem` stays dependency-light.
- [x] Verification: `pnpm run lint` + `pnpm run test` + `pnpm run build`.

## Remote rate limiting evolution

- [x] Document necessity/trade-offs and alternatives (`docs/REMOTE_RATE_LIMITING.md`).
- [x] Keep throttling and add adaptive cooldown behavior for rate-limit/transient failures.
- [x] Support `retryAfterMs`/`Retry-After` hints when available.
- [x] Move rate limiting to provider strategy chain and remove runtime/settings coupling.
- [x] Remove external toggle (`enableRateLimitedRemoteFileSystem`) and keep provider-internal defaults.
- [x] Extend unit tests for adaptive cooldown and strategy composition behavior.
