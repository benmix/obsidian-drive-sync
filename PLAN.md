# Obsidian Proton Drive Sync - Plan

## 0. Inputs and Constraints

- SDK public API only; internal fields are not stable.
- Remote identity: use Proton Drive node `uid` as stable ID; revision uses `Revision.uid`.
- Session refresh is not exposed by SDK public API; session lifecycle managed by injected `httpClient`.
- Desktop-first target; avoid Node/Electron APIs where possible.

## 1. Milestone 0 - Feasibility

1. Validate login flow with injected `httpClient`.
2. Verify `list`, `create`, `upload`, `download`, `delete`, `move` on a scoped Remote Root.
3. Confirm node `uid` stability across rename/move and new revision uploads.
4. Collect remote metadata for change detection: `activeRevision.uid`, `modificationTime`, `storageSize`.

## 2. Milestone 1 - MVP (manual sync)

1. Implement LocalFS adapter (Obsidian vault events + snapshot).
2. Implement RemoteFS adapter using SDK public API only.
3. Build Index DB (entries + jobs).
4. Build reconciler and job queue with idempotent ops.
5. Manual sync command: one-shot reconcile + execute queue.

## 3. Milestone 2 - Auto Sync

1. Incremental local changes (debounce + rename handling).
2. Remote polling snapshot diff (no official cursor).
3. Conflict detection and default resolution (local wins + conflicted copy).
4. Health & status view (queue size, last error, pause/resume).

## 4. Milestone 3 - Hardening

1. Retry policy with backoff and auth pause.
2. Crash recovery and resume (tombstones, pending jobs).
3. Diagnostics export (logs + redacted state).
4. Performance tuning for large vaults (batching, throttling).

## 5. Open Questions / Risks

- Is there an official change feed or cursor for Drive?
- Is there a stronger remote change fingerprint we can rely on?
