# Coding Standards

## 1. Purpose

This document defines repository-specific coding standards for Obsidian Drive Sync.

It is not a generic TypeScript guide. The goal is to keep changes aligned with this repository's sync architecture, runtime boundaries, and plugin behavior.

## 2. Core Principles

- Prefer clarity over cleverness.
- Extend existing flows before introducing new abstractions.
- Keep provider-specific logic out of provider-agnostic layers.
- Make runtime behavior explicit, especially for sync, state, and error handling.
- Optimize for maintainability under real plugin reload, retry, and recovery scenarios.

## 3. Layer Boundaries

Source code lives under `src/` and should follow the current layering:

- `src/main.ts`: minimal plugin entrypoint
- `src/runtime/`: lifecycle orchestration, coordination, session control, app-facing runtime behavior
- `src/sync/`: provider-agnostic sync planning, execution, state transitions, and sync support logic
- `src/provider/`: provider-specific integrations and SDK adapters
- `src/ui/`: settings UI, modals, and user-facing rendering
- `src/contracts/`: shared contracts and cross-layer types
- `src/data/`: persistence and IndexedDB access
- `src/errors/`: structured error system and normalization helpers
- `src/i18n/`: translations and localization helpers

Boundary rules:

- `runtime/` must not depend on `ui/` implementation details or concrete provider modules.
- `provider/` must not depend on `runtime/` or `sync/` internals.
- `sync/` must remain provider-agnostic.
- `ui/` may consume runtime-facing contracts, but it should not own sync engine behavior.
- Shared types should move to `contracts/` instead of creating hidden cross-imports.

If a change seems to require breaking these boundaries, reconsider the design first.

## 4. File And Module Design

- Keep `src/main.ts` small and focused on plugin bootstrap, registration, and teardown.
- Prefer small, focused modules over large multi-purpose files.
- If a file starts mixing orchestration, persistence, UI formatting, and provider behavior, split it.
- Add new modules near the layer that owns the behavior instead of creating generic `utils` buckets.
- Avoid introducing parallel abstractions when an existing use-case or service module can be extended.

Recommended split triggers:

- the file is difficult to review in one pass
- multiple responsibilities are changing for unrelated reasons
- tests would become clearer if logic were isolated
- imports show the file is spanning several layers at once

## 5. TypeScript Rules

- Keep TypeScript strict.
- Prefer explicit domain types over loose records or ad-hoc object literals.
- Use `unknown` for unknown error or external input boundaries, then normalize it.
- Prefer narrow unions and named interfaces or type aliases for cross-module data.
- Avoid `any` unless there is a hard external constraint and the escape hatch is documented.
- Prefer `readonly` data where mutation is not required.

## 6. Imports And Dependencies

- Prefer direct imports from the owning module.
- Keep imports aligned with the layer model; do not reach across the architecture casually.
- Avoid cyclic dependencies. If two modules need each other, move the shared contract down into `contracts/` or refactor ownership.
- Use repository scripts and lint rules to catch ordering and layer issues instead of hand-waving them in review.

Validation tools in this repository:

- `pnpm run lint`
- `pnpm run lint:fix`
- `pnpm run lint:layers`
- `pnpm run fix:imports`

## 7. Async And Side Effects

- Prefer `async` / `await` over long promise chains.
- Keep side effects near orchestration boundaries so they are easier to reason about.
- Do not hide filesystem, network, or persistence writes inside generic helpers without clear naming.
- Avoid heavy work in plugin startup if it can be deferred safely.
- Debounce or batch filesystem-triggered work when possible.

## 8. Error Handling

- New code should prefer structured errors via `src/errors/` instead of raw string matching.
- Normalize external SDK or unknown errors before using them for runtime decisions.
- Keep user-facing copy separate from diagnostic detail.
- Do not leak credentials, raw provider identifiers, or unsafe internal details into normal UI.
- If a failure changes runtime state, make that state transition explicit in code.

See [`docs/ERROR_SYSTEM_DESIGN.md`](./ERROR_SYSTEM_DESIGN.md) for the broader design.

## 9. UI And User Copy

- Keep UI strings short, direct, and consistent.
- Prefer sentence case for titles, buttons, and section labels.
- Show user-safe error messages in normal UI; keep raw technical detail for diagnostics.
- When changing status logic, update both the state semantics and the presentation.
- Respect the existing visual language unless the task is explicitly a redesign.

## 10. Persistence And State

- Treat persisted plugin state and sync state as durable contracts.
- Prefer additive schema evolution over destructive rewrites unless migration is explicit.
- Keep persisted field names stable and behaviorally meaningful.
- Distinguish transient runtime state from persisted recovery state.
- When adding retry, blocked, or auth-related state, make recovery semantics explicit.

## 11. Testing Expectations

- Add or update targeted tests for non-trivial logic changes.
- Prefer unit tests for pure sync logic, planners, state transitions, and error normalization.
- Use `pnpm run build` as the minimum broad verification for code changes.
- Run `pnpm run lint` when the change affects structure, imports, style, or cross-module boundaries.
- If you skip a relevant check, document that in the change summary.

## 12. Documentation Expectations

- User-facing docs under `docs/` must stay bilingual with matching files under `docs/zh-CN/`.
- Update docs when behavior, workflows, or constraints change.
- Prefer repository-specific guidance over generic sample-plugin wording.
- Keep examples aligned with the current repository structure.

## 13. Practical Do / Don't

Do:

- Reuse existing runtime and sync flows.
- Isolate provider-specific behavior in `provider/`.
- Keep plugin lifecycle code minimal.
- Make state transitions and retry behavior obvious.
- Write code that survives reload, retry, and partial failure scenarios.

Don't:

- Put provider-specific behavior into `sync/`.
- Add compatibility glue without an explicit requirement.
- Smuggle side effects into formatting or helper functions.
- Depend on message text for core runtime decisions in new code.
- Introduce broad abstractions that the rest of the repository does not need.
