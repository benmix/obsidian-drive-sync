# Remote Rate Limiting Technical Design

## 1. Background and Problem

Remote filesystem operations are burst-prone by nature:

- Large sync rounds can generate dense `list/upload/download/delete/move` traffic.
- Different providers expose different throughput limits and rate-limit semantics.
- Once 429 or transient network instability appears, naive retries can amplify failure cascades.

If rate limiting lives in runtime or behind external toggles, it introduces three problems:

1. Layer responsibility confusion (runtime leaks into provider IO concerns).
2. Critical stability protections can be accidentally disabled (configuration drift).
3. New provider reuse becomes expensive (copy-paste and behavior divergence).

We therefore need a provider-owned, reusable, and testable rate-limiting design.

## 2. Goals and Non-Goals

### 2.1 Goals

- Provide a unified remote IO throttling layer without changing sync-kernel algorithms.
- Keep `sync/*` and `runtime/*` unaware of rate-limit implementation details.
- Enable strategy reuse so new providers can adopt the same mechanism directly.
- Apply adaptive cooldown for 429 and transient failures to reduce instability-period failure rates.

### 2.2 Non-Goals

- No runtime-level on/off toggle for rate limiting.
- No user-exposed settings for provider rate-limit state.
- No cross-provider global scheduler in this iteration.

## 3. Constraints

- Layering: provider may depend on filesystem contracts; sync/runtime must not depend on provider implementation details.
- Interface: strategy input/output must remain `RemoteFileSystem -> RemoteFileSystem`.
- Behavior: business semantics must remain unchanged; only call pacing and retry cooldown behavior may change.

## 4. Solution Overview

Adopt a **Provider-side Strategy Chain**:

1. Define common strategy type and composition utility:
   `RemoteFileSystemStrategy` + `applyRemoteFileSystemStrategies`
2. Host a reusable rate-limit strategy under provider strategy directory:
   `src/provider/strategy/rate-limited-remote-file-system-strategy.ts`
3. Compose the strategy inside provider `createRemoteFileSystem(...)`.
4. Let runtime/sync consume only the final `RemoteFileSystem` abstraction.

The default provider `proton-drive` already enables this strategy chain.

## 5. Layered Design

```text
sync/* ---------------> RemoteFileSystem (abstract)
                           ^
runtime/* ------------->   |
                           |
provider/* -- compose --> [base remote fs] -> [rate-limit strategy] -> final remote fs
```

- `sync/*`: executes existing workflow against remote abstraction, no rate-limit awareness.
- `runtime/*`: orchestrates execution, does not inject or wrap rate limiting.
- `provider/*`: owns strategy enablement, ordering, and defaults.

This preserves provider-agnostic sync kernel boundaries.

## 6. Core Interfaces

### 6.1 Strategy Contract

File: `src/provider/strategy/contracts.ts`

- `RemoteFileSystemStrategyContext`
    - `providerId`
    - `client`
    - `scopeId`
- `RemoteFileSystemStrategy`
    - `(remoteFileSystem, context) => remoteFileSystem`
- `applyRemoteFileSystemStrategies(...)`
    - Composes strategies in sequence.

### 6.2 Rate-Limit Strategy Factory

File: `src/provider/strategy/rate-limited-remote-file-system-strategy.ts`

- `createRateLimitedRemoteFileSystemStrategy(options?)`
- Returns wrapped `RateLimitedRemoteFileSystem`.

## 7. Rate-Limiting Algorithm

### 7.1 Scheduling Model

- Internal queue: `taskQueue`
- `maxConcurrent` limits active parallel operations.
- `minIntervalMs` enforces minimum start interval between operations.
- `cooldownUntil` pauses dispatch during cooldown windows.

Operation start condition:

1. `activeTasks < maxConcurrent`
2. `now >= max(nextStartAt, cooldownUntil)`

### 7.2 Default Parameters

| Parameter        | Default | Meaning                          |
| ---------------- | ------- | -------------------------------- |
| `maxConcurrent`  | `1`     | single concurrency for stability |
| `minIntervalMs`  | `150`   | base dispatch interval           |
| `cooldownBaseMs` | `1000`  | cooldown base                    |
| `cooldownMaxMs`  | `30000` | cooldown cap                     |

### 7.3 Failure Classification and Cooldown

Failures are classified into two categories:

1. `rate_limit`
    - Typical: HTTP 429 or rate-limit keywords in error content.
    - Cooldown: prefer `retryAfterMs/Retry-After`; otherwise exponential backoff.
2. `transient`
    - Typical: 408/425/500/502/503/504 or network/timeout keywords.
    - Cooldown: exponential backoff bounded by `cooldownMaxMs`.

Successful operation resets failure streak counters (rate-limit and transient independently).

### 7.4 Special Path Handling

- `subscribeToTreeEvents(...)` is not queued.
    - Rationale: this is a control-plane one-time subscription and should not be blocked by data-plane traffic.

## 8. Provider Composition

Default provider implementation file:
`src/provider/providers/proton-drive/provider.ts`

Inside `createRemoteFileSystem(client, scopeId)`:

1. Build base remote fs (SDK adapter).
2. Compose rate-limit strategy via `applyRemoteFileSystemStrategies(...)`.
3. Return final remote fs to runtime/sync.

This keeps strategy injection point explicit and reviewable.

## 9. Design Tradeoffs

### 9.1 Why Not in Runtime

- Runtime is responsible for sync triggering/orchestration, not provider IO pacing.
- Runtime-based throttling breaks provider cohesion and weakens per-provider specialization.

### 9.2 Why Not a Settings Toggle

- Rate limiting is a safety mechanism and should not be disabled by accidental user action.
- In practice, "toggle disabled" is a high-frequency reliability incident with limited upside.

### 9.3 Why Not a Global Cross-Provider Limiter

- Current model is primarily single active provider.
- Global scheduler adds coupling/complexity with low immediate payoff.

## 10. Risks and Mitigations

- Overly conservative limits may reduce throughput:
    - Tune provider-internal parameters without breaking layering.
- Failure misclassification:
    - Cover status/message/Retry-After parsing with focused unit tests.
- New provider forgets strategy composition:
    - Enforce via provider template and code-review checklist.

## 11. Acceptance Criteria

### 11.1 Structural Acceptance

- Rate-limit implementation lives in `provider/strategy/*`.
- runtime/sync have no direct dependency on rate-limit implementation files.
- provider composes strategy within `createRemoteFileSystem(...)`.

### 11.2 Behavioral Acceptance

- Under repeated 429 responses, request pace slows down and honors `Retry-After`.
- Under transient failures, cooldown triggers and normal pace resumes after success.
- Tree-event subscription path is not blocked by queued data operations.

### 11.3 Pre-Release Checks

- `pnpm run lint`
- `pnpm run test`
- `pnpm run build`

## 12. Related Implementation Files

- `src/provider/strategy/contracts.ts`
- `src/provider/strategy/rate-limited-remote-file-system-strategy.ts`
- `src/provider/providers/proton-drive/provider.ts`
- `src/runtime/sync-coordinator.ts` (verify no runtime-side limiter injection)
- `src/settings.ts` / `src/main.ts` (verify no external limiter toggle)
