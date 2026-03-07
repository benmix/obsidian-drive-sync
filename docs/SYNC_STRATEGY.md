# Runtime Sync Strategy Specification

> Effective date: 2026-03-07
> This document defines runtime behavior after initialization completes.
> For first-time initialization strategy, see `SYNC_INITIALIZATION_STRATEGY.md`.

## 1. Goals and Scope

1. Define three unified strategies: `local_win` / `remote_win` / `bidirectional`.
2. Define runtime decision rules for files, folders, conflicts, and missing confirmations.
3. Constrain implementation boundaries to avoid strategy forks and hidden high-risk behavior.
4. Provide executable acceptance criteria to ensure implementation follows documentation.

## 2. Terminology

- `local`: local filesystem view of the Obsidian vault.
- `remote`: remote storage filesystem view.
- `tracked`: a path that already has sync state mapping (`SyncEntry`).
- `tombstone`: local deletion marker waiting for remote convergence.
- `conflict_pending`: path is in pending conflict state awaiting manual merge.

## 3. Global Rules (Highest to Lowest Priority)

1. Conflict protection first: paths in `conflict_pending` must not auto-run canonical upload/download.
2. Tombstone convergence first: when `tombstone` exists, prioritize delete convergence over regular incremental updates.
3. Double-confirm remote missing: remote missing must be confirmed in two consecutive rounds before destructive convergence.
4. Normal strategy decision: execute by the `local_win` / `remote_win` / `bidirectional` matrix.

## 4. Strategy Definitions

### 4.1 `local_win`

- Local is the source of authority; remote mirrors local.
- Principle: except for conflict copies, remote content must not overwrite the local canonical file.

### 4.2 `remote_win`

- Remote is the source of authority; local mirrors remote.
- Principle: except for local conflict backups, local content must not overwrite the remote canonical file.

### 4.3 `bidirectional`

- Bi-directional sync; no automatic side selection on conflict.
- Principle: on conflict, produce conflict copy and enter `conflict_pending`, then resume after manual merge.

## 5. Decision Matrix

| Scenario             | `local_win`                                            | `remote_win`                                           | `bidirectional`                                        |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------ |
| local-only (file)    | `upload`                                               | `delete-local`                                         | `upload`                                               |
| remote-only (file)   | `delete-remote`                                        | `download`                                             | `download`                                             |
| both changed (file)  | `download remote copy` + `upload local`                | `backup local copy` + `download remote`                | `create conflict copy` + `mark conflict_pending`       |
| local-only (folder)  | `create-remote-folder`                                 | `delete-local`                                         | `create-remote-folder`                                 |
| remote-only (folder) | `delete-remote`                                        | `create-local-folder`                                  | `create-local-folder`                                  |
| tracked both missing | cleanup mapping (and perform required cleanup deletes) | cleanup mapping (and perform required cleanup deletes) | cleanup mapping (and perform required cleanup deletes) |

## 6. Special-Case Rules

### 6.1 Double-Confirm Remote Missing

1. For tracked remote-missing paths, first round only increments `remoteMissingCount`; no destructive action.
2. Strategy-driven convergence (delete local or recreate remote) is allowed only after two consecutive confirmations.

### 6.2 Tombstone Convergence

1. `tombstone` means "deleted locally, pending remote delete".
2. Under non-`remote_win`, if remote object still exists, prioritize planning `delete-remote` convergence.

### 6.3 `conflict_pending` Suppression

1. Do not generate repeated conflict jobs for the same path while `conflict_pending` is active.
2. After user clears conflict marker and finishes manual merge, path returns to normal incremental sync.

## 7. Conflict Handling Specification (Unified Copy Model)

1. Conflict handling no longer exposes a direct "overwrite by side" strategy path.
2. Always keep one editable canonical file.
3. Write the opposite-side version into a conflict copy with naming format:

```text
<filename> (conflicted <source> YYYY-MM-DD HHmm).<ext>
```

4. `<source>` may only be:
    - `remote`
    - `local`

## 8. Implementation Constraints (Code-Level)

1. Use unified config field `syncStrategy` with enum values only:
    - `local_win`
    - `remote_win`
    - `bidirectional`
2. Do not add any `manual` conflict strategy code path.
3. Centralize strategy branching in planner layer (`presence-policy` / `reconciler` / `remote-poller`); execution layer consumes jobs only and must not fork by strategy.
4. Any action that could cause bulk deletion must be visible and abortable in preflight.

## 9. Testing and Acceptance Criteria

### 9.1 Minimum Unit Test Coverage

1. `local-only` / `remote-only` behavior under all three strategies (file + folder).
2. Correct conflict copy generation and job types for `both changed`.
3. Double-confirm behavior for remote missing.
4. Tombstone convergence behavior.
5. `conflict_pending` suppression and release.
6. Local-clear behavior after initialization:
    - no initialization hard-rule shortcut;
    - behavior strictly follows current `syncStrategy`.

### 9.2 Integration Acceptance

1. `planSync -> runPlannedSync` behavior matches the decision matrix.
2. `runAutoSync` and `pollRemoteSync` do not show reversed strategy behavior.
3. In the "local cleared after initialization" scenario, behavior must strictly follow the matrix.

### 9.3 Release Gate

1. `pnpm run lint` passes.
2. `pnpm run test` passes.
3. `pnpm run build` passes.
4. Manual verification includes at least one "local cleared after initialization" scenario.
