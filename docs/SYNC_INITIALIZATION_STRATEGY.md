# Sync Initialization Strategy

> Effective date: 2026-03-09
> This document applies only while the plugin is establishing the first trusted baseline. After initialization completes, switch to [`SYNC_STRATEGY.md`](./SYNC_STRATEGY.md).

## 1. Purpose

Initialization is a separate phase because the system does not yet have a trusted baseline. The goals are:

- establish a reliable first baseline
- avoid accidental destructive behavior when local and remote state disagree
- make high-risk decisions visible before execution

## 2. Entry And Exit Conditions

### 2.1 Enter Initialization

Initialization starts when any of the following is true:

1. no trusted sync baseline exists
2. no reliable `lastSyncAt` exists because this is a first install or state reset
3. the user explicitly starts a re-initialization flow

### 2.2 Exit Initialization

Initialization ends only when all of the following are true:

1. planned initialization work is finished with no blocking failures
2. a trusted baseline has been written for future incremental decisions
3. an `initializationCompleted` marker or equivalent state is set

## 3. Global Rules

From highest to lowest priority:

1. initialization must run with preflight and visible upload, download, and delete counts
2. if local is empty and remote is non-empty, remote restore wins regardless of strategy
3. when two valid choices exist, choose the lower-risk path
4. if no hard rule applies, fall back to `syncStrategy`

## 4. Decision Matrix

| Scenario                      | `local_win`                                                                         | `remote_win`                                                                         | `bidirectional`                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| local empty, remote non-empty | forced `download` and `create-local-folder`                                         | forced `download` and `create-local-folder`                                          | forced `download` and `create-local-folder`                                                                                                               |
| local non-empty, remote empty | `upload` and `create-remote-folder`                                                 | `delete-local` after a second high-risk confirmation                                 | `upload` and `create-remote-folder`                                                                                                                       |
| local empty, remote empty     | write an empty baseline and do nothing else                                         | write an empty baseline and do nothing else                                          | write an empty baseline and do nothing else                                                                                                               |
| both sides non-empty          | write baseline for unchanged same-path files; otherwise follow `local_win` behavior | write baseline for unchanged same-path files; otherwise follow `remote_win` behavior | write baseline for unchanged same-path files; otherwise use `mtime` as an initialization-only tie-break and fall back to conflict when still inconclusive |

## 5. Same-Path Baseline Shortcut

This shortcut applies only during initialization and only to files that exist at the same relative path on both sides.

Decision order:

1. compare normalized `mtime` and `size` when both are available
2. if metadata is inconclusive, compare file content as an initialization-only fallback
3. if the content is identical, treat the file as unchanged
4. unchanged files write baseline only and schedule no upload, download, or conflict-copy job

This shortcut applies to all three strategies.

## 6. Bidirectional Time-Based Tie-Break

If the same-path shortcut does not prove equality, `bidirectional` gets one extra initialization-only rule for files that exist on both sides.

Decision rules:

1. if both sides expose valid `mtime`, compare them
2. if local is newer, schedule `upload`
3. if remote is newer, schedule `download`
4. if metadata is missing or still inconclusive, do not auto-pick a side; fall back to conflict behavior

Constraints:

- this rule does not apply to folders
- this rule does not apply after initialization ends
- the rule exists only to avoid unnecessary conflicts while no baseline exists yet

## 7. Empty-Local Remote Restore Hard Rule

Trigger conditions:

1. initialization phase is active
2. local vault is empty
3. remote root is not empty

Required behavior:

- allow only `download` and `create-local-folder`
- explicitly forbid `upload` and `delete-remote`
- write the baseline immediately after restore finishes
- switch to runtime strategy after initialization completes

This hard rule must never reactivate later just because the local side was cleared after initialization.

## 8. Preflight And Confirmation

Before initialization runs, preflight must show:

- upload count
- download count
- local delete count
- remote delete count

Additional rules:

- any delete count requires a second confirmation
- `remote_win` with local non-empty and remote empty is high-risk and should be blocked by default until explicitly confirmed

## 9. Failure Recovery

- initialization must be re-entrant after interruption
- partially written baseline and queue state should be reused where safe
- runtime incremental sync must not start before initialization completes
- repeated failures should eventually enter a blocking state that requires user action

## 10. Boundary With Runtime Sync

- this document governs first baseline establishment and explicit re-initialization
- [`SYNC_STRATEGY.md`](./SYNC_STRATEGY.md) governs ongoing sync after baseline exists
- a single decision cycle belongs to one phase only

## 11. Verification Requirements

### 11.1 Minimum Unit Coverage

- initialization phase detection and exit logic
- empty-local restore allows only download and local-folder creation
- same-path unchanged files write baseline only under every strategy
- `bidirectional` chooses upload when local `mtime` is newer
- `bidirectional` chooses download when remote `mtime` is newer
- inconclusive metadata falls back to strategy-specific handling
- post-initialization local clear does not retrigger the hard rule
- `remote_win` high-risk flow requires second confirmation

### 11.2 Integration Coverage

- first install with existing remote data restores local correctly
- first install with both sides non-empty respects strategy rules
- same-path files with equivalent normalized metadata write baseline only
- same-path files with inconclusive metadata but equal content write baseline only
- same-path files with different `mtime` values choose the newer side under `bidirectional`
- interrupted initialization can resume and complete

### 11.3 Release Gate

- `pnpm run lint` passes
- `pnpm run test` passes
- `pnpm run build` passes
- manual verification includes a full empty-local remote-restore flow
- manual verification includes a same-path unchanged flow
- manual verification includes a same-path bidirectional flow with different local and remote `mtime`
