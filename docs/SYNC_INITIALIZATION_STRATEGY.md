# Sync Initialization Strategy (First Baseline Establishment)

> Effective date: 2026-03-07
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

| Initialization Scenario           | `local_win`                                 | `remote_win`                                             | `bidirectional`                                     |
| --------------------------------- | ------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| Local empty, remote non-empty     | `download/create-local-folder` (forced)     | `download/create-local-folder` (forced)                  | `download/create-local-folder` (forced)             |
| Local non-empty, remote empty     | `upload/create-remote-folder`               | `delete-local` (high risk, requires second confirmation) | `upload/create-remote-folder`                       |
| Local empty, remote empty         | no-op (write empty baseline)                | no-op (write empty baseline)                             | no-op (write empty baseline)                        |
| Local non-empty, remote non-empty | follow `local_win` and keep conflict copies | follow `remote_win` and keep conflict copies             | follow `bidirectional` and enter `conflict_pending` |

## 5. Empty-Local Remote Restore (Hard Rule)

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

## 6. Preflight and Confirmation

1. Before initialization execution, preflight must show:
    - upload count
    - download count
    - delete count (local and remote separated)
2. If any delete count is greater than zero, second confirmation is mandatory.
3. Under `remote_win`, "local non-empty + remote empty" is a high-risk scenario. It is blocked by default and may continue only after explicit user confirmation.

## 7. Failure Recovery and Retry

1. Initialization must be re-entrant after interruption; continue unfinished work using already written baseline/state.
2. Do not switch to runtime incremental path before initialization finishes.
3. If consecutive failures reach threshold, enter blocking state and require user intervention (auth, network, permissions, etc.).

## 8. Boundary with Runtime Strategy

1. This document governs first baseline establishment.
2. Runtime document (`SYNC_STRATEGY.md`) governs continuous sync after baseline exists.
3. Both phases must not be active in the same decision cycle; each cycle belongs to one phase only.

## 9. Testing and Acceptance Criteria

### 9.1 Minimum Unit Test Coverage

1. Initialization phase detection (enter/exit).
2. Empty-local restore outputs only `download/create-local-folder`.
3. After initialization completes, local clear must not trigger initialization hard rule.
4. `remote_win` high-risk scenario requires second-confirmation gate.

### 9.2 Integration Acceptance

1. First install + existing remote data -> local restored correctly.
2. First install + both sides non-empty -> strategy respected and conflict copies retained.
3. Initialization interrupted then restarted -> can continue and complete baseline write.

### 9.3 Release Gate

1. `pnpm run lint` passes.
2. `pnpm run test` passes.
3. `pnpm run build` passes.
4. Manual verification includes at least one full empty-local remote-restore initialization flow.
