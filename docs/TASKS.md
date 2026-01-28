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
- [x] Validate settings inputs (remote folder selection, exclude preview).

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
- [ ] Add unit tests for adapters, reconciler, job queue, exclude rules.
