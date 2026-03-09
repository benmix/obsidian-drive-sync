# Sync Initialization Strategy (First Baseline Establishment)

> Effective date: 2026-03-09
> This document constrains behavior only during the initialization phase.
> After initialization completes, switch to `SYNC_STRATEGY.md`.

## 1. Goals and Scope

1. Define decision rules for first sync when no stable baseline exists.
2. Clarify risk controls, preflight confirmation, exit conditions, and recovery behavior in initialization.
3. Ensure initialization does not cause accidental large-scale destructive actions due to strategy ambiguity.

## 2. Entry and Exit Conditions

### 2.1 Enter Initialization Phase

Enter initialization when any of the following is true:

1. No stable sync baseline is detected (no valid `entries` / `synced*` baseline).
2. No trusted `lastSyncAt` exists (first install or state reset).
3. User explicitly triggers a re-initialization flow.

### 2.2 Exit Initialization Phase

Exit initialization only when all of the following are true:

1. Planned initialization jobs are completed (queue empty and no blocking failures).
2. Sync baseline has been written (`syncedLocalHash` / `syncedRemoteRev` available for future incremental decisions).
3. `initializationCompleted = true` (or equivalent state marker) is set.

## 3. Global Initialization Rules (Highest to Lowest Priority)

1. Safety first: initialization must run with preflight and show upload/download/delete counts.
2. Empty-local restore first: when local is empty and remote is non-empty, force remote-to-local restore.
3. Prefer lower risk: when alternatives exist, prefer non-destructive actions.
4. Strategy fallback: if no hard rule matches, decide by `syncStrategy`.

## 4. Initialization Decision Matrix

| Initialization Scenario           | `local_win`                                                                                          | `remote_win`                                                                                          | `bidirectional`                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local empty, remote non-empty     | `download/create-local-folder` (forced)                                                              | `download/create-local-folder` (forced)                                                               | `download/create-local-folder` (forced)                                                                                                                         |
| Local non-empty, remote empty     | `upload/create-remote-folder`                                                                        | `delete-local` (high risk, requires second confirmation)                                              | `upload/create-remote-folder`                                                                                                                                   |
| Local empty, remote empty         | no-op (write empty baseline)                                                                         | no-op (write empty baseline)                                                                          | no-op (write empty baseline)                                                                                                                                    |
| Local non-empty, remote non-empty | same-path unchanged files write baseline only; otherwise follow `local_win` and keep conflict copies | same-path unchanged files write baseline only; otherwise follow `remote_win` and keep conflict copies | same-path files first check `mtime+size`; unchanged files write baseline only; otherwise newer side wins by `mtime`; undecidable cases enter `conflict_pending` |

## 5. Initialization Same-Path Baseline Shortcut

This rule applies only during initialization and only to file paths that exist on both sides.

Decision rules:

1. If both local and remote file metadata expose valid `mtime` and `size`, and `size` matches while `mtime` matches after provider-precision normalization, treat the file as unchanged.
2. If metadata does not prove equality but both sides still expose a same-path file, compare file content as an initialization-only fallback.
3. If content is identical, treat the file as unchanged.
4. For unchanged files, write sync baseline only; do not schedule `upload`, `download`, or conflict-copy jobs.
5. This shortcut applies to `local_win`, `remote_win`, and `bidirectional`.

## 6. Bidirectional Initialization Time-Based Resolution

If the same-path baseline shortcut above does not match, `bidirectional` applies an extra initialization-only tie-break for files that exist on both sides.

Decision rules:

1. If both sides expose valid `mtime`, compare them.
2. If local `mtime` is newer, schedule `upload` and let the remote write create the next remote revision.
3. If remote `mtime` is newer, schedule `download` and overwrite the local file.
4. If the metadata needed for the checks above is missing or inconclusive, do not auto-pick a side; fall back to the normal bidirectional conflict flow.

Constraints:

1. This rule does not apply to folders.
2. This rule does not apply after initialization completes.
3. The same-path baseline shortcut first uses normalized metadata and may fall back to direct content comparison; it still does not persist content hashes for baseline establishment.
4. The `bidirectional` time-based rule is a tie-break only for initialization; runtime `bidirectional` behavior remains conflict-based.

## 7. Empty-Local Remote Restore (Hard Rule)

Trigger conditions (all must hold):

1. Current phase is initialization.
2. Local is empty.
3. Remote is non-empty.

Execution requirements:

1. Only `download` and `create-local-folder` are allowed.
2. `upload` and `delete-remote` are explicitly forbidden.
3. After restore completes, write sync baseline immediately and switch to runtime strategy.

Constraints:

1. This rule applies only during initialization.
2. If local is cleared after initialization completes, this rule must not be re-triggered.

## 8. Preflight and Confirmation

1. Before initialization execution, preflight must show:
    - upload count
    - download count
    - delete count (local and remote separated)
2. If any delete count is greater than zero, second confirmation is mandatory.
3. Under `remote_win`, "local non-empty + remote empty" is a high-risk scenario. It is blocked by default and may continue only after explicit user confirmation.

## 9. Failure Recovery and Retry

1. Initialization must be re-entrant after interruption; continue unfinished work using already written baseline/state.
2. Do not switch to runtime incremental path before initialization finishes.
3. If consecutive failures reach threshold, enter blocking state and require user intervention (auth, network, permissions, etc.).

## 10. Boundary with Runtime Strategy

1. This document governs first baseline establishment.
2. Runtime document (`SYNC_STRATEGY.md`) governs continuous sync after baseline exists.
3. Both phases must not be active in the same decision cycle; each cycle belongs to one phase only.

## 11. Testing and Acceptance Criteria

### 11.1 Minimum Unit Test Coverage

1. Initialization phase detection (enter/exit).
2. Empty-local restore outputs only `download/create-local-folder`.
3. Initialization writes baseline only for same-path files proven unchanged by normalized metadata or content comparison, under all strategies.
4. Bidirectional initialization prefers `upload` when local file `mtime` is newer.
5. Bidirectional initialization prefers `download` when remote file `mtime` is newer.
6. Inconclusive metadata, including equal `mtime` with different `size`, falls back to strategy-specific handling.
7. After initialization completes, local clear must not trigger initialization hard rule.
8. `remote_win` high-risk scenario requires second-confirmation gate.

### 11.2 Integration Acceptance

1. First install + existing remote data -> local restored correctly.
2. First install + both sides non-empty -> strategy respected.
3. First install + both sides contain same-path file with equivalent normalized `mtime` and equal `size` -> baseline is written without upload/download/conflict copy.
4. First install + both sides contain same-path file with inconclusive metadata but identical content -> baseline is written without upload/download/conflict copy.
5. First install + both sides contain same-path file -> newer `mtime` side wins under `bidirectional`.
6. First install + both sides contain same-path file but metadata and content are inconclusive -> strategy-specific path is retained.
7. Initialization interrupted then restarted -> can continue and complete baseline write.

### 11.3 Release Gate

1. `pnpm run lint` passes.
2. `pnpm run test` passes.
3. `pnpm run build` passes.
4. Manual verification includes at least one full empty-local remote-restore initialization flow.
5. Manual verification includes at least one same-path initialization flow with normalized-equal `mtime` and equal `size`.
6. Manual verification includes at least one same-path bidirectional initialization flow with different local/remote `mtime`.
