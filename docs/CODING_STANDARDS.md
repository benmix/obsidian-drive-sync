# Coding Standards

## 1. Purpose

This document defines repository-specific engineering rules for Obsidian Drive Sync. It is not a generic TypeScript style guide. The point is to keep changes aligned with the repository's sync model, runtime boundaries, and recovery behavior.

## 2. Core Principles

- Prefer clarity over cleverness.
- Extend existing flows before adding new abstractions.
- Keep provider-specific behavior out of provider-agnostic layers.
- Make state transitions, retries, and failure handling explicit.
- Optimize for maintainability under reload, retry, and partial-failure conditions.

## 3. Layer Boundaries

Source code lives under `src/` and follows this ownership model:

- `src/main.ts`: plugin facade, lifecycle wiring, and delegation
- `src/runtime/`: orchestration, sessions, scheduling, and app-facing runtime behavior
- `src/sync/`: provider-agnostic planning, execution, and sync state behavior
- `src/provider/`: provider-specific integrations and SDK adapters
- `src/ui/`: settings UI, modals, and user-facing rendering
- `src/contracts/`: shared contracts and cross-layer types
- `src/data/`: persistence and IndexedDB access
- `src/errors/`: structured errors and normalization helpers
- `src/i18n/`: translation and localization helpers

Boundary rules:

- `runtime/` must not depend on concrete provider implementations or UI internals.
- `provider/` must not depend on `runtime/` or `sync/` internals.
- `sync/` must stay provider-agnostic.
- `ui/` may depend on plugin-facing contracts, but it must not own sync-engine behavior.
- Shared contracts belong in `contracts/`, not in accidental cross-import chains.

If a change seems to require breaking these boundaries, revisit ownership before writing code.

## 4. File And Module Design

- Keep `src/main.ts` small.
- Prefer focused modules over broad multi-purpose files.
- Split files that mix orchestration, persistence, UI formatting, and provider behavior.
- Add new modules near the layer that owns the behavior.
- Avoid creating generic `utils` buckets when the logic belongs to a real domain module.

A file is ready to split when:

- it is hard to review in one pass
- unrelated changes keep landing in the same file
- tests would be clearer if the logic were isolated
- the import list spans too many architectural layers

## 5. TypeScript Rules

- Keep the codebase strict.
- Prefer explicit domain types over loose records and ad-hoc objects.
- Use `unknown` at unsafe boundaries and normalize immediately.
- Prefer narrow unions and named interfaces for cross-module data.
- Avoid `any` unless an external dependency forces it.
- Prefer `readonly` data where mutation is not required.

## 6. Imports And Dependencies

- Import from the owning module, not from convenience re-exports that hide ownership.
- Keep imports aligned with the layer model.
- Avoid cyclic dependencies. If two modules need the same concepts, move the shared contract down.
- Let repository checks enforce structure.

Repository checks:

- `pnpm run lint`
- `pnpm run lint:fix`
- `pnpm run lint:layers`
- `pnpm run fix:imports`

## 7. Async And Side Effects

- Prefer `async` and `await` over long promise chains.
- Keep side effects near orchestration boundaries.
- Do not hide filesystem, network, or persistence writes inside vague helpers.
- Avoid expensive startup work when it can be deferred safely.
- Debounce or batch filesystem-triggered work when practical.

## 8. Error Handling

- New code should use structured errors from `src/errors/`.
- Normalize provider or SDK failures before using them in runtime decisions.
- Keep user-facing copy separate from diagnostic detail.
- Do not leak credentials or unsafe provider details into normal UI.
- Make state changes caused by failures explicit in code.

See [`docs/ERROR_SYSTEM_DESIGN.md`](./ERROR_SYSTEM_DESIGN.md) for the system-level design.

## 9. UI And User Copy

- Keep strings short and direct.
- Use sentence case for titles, buttons, and labels.
- Prefer safe, translated error messages in normal UI.
- When status semantics change, update the presentation and the state model together.
- Preserve the established UI language unless the task explicitly asks for a redesign.

## 10. Persistence And State

- Treat persisted fields as durable contracts.
- Prefer additive schema changes unless a migration is explicit and tested.
- Keep field names stable and behaviorally meaningful.
- Distinguish transient runtime state from recovery state that must survive reload.
- Make retry, blocked, and auth-related recovery semantics explicit.

## 11. Testing Expectations

- Add targeted tests for non-trivial logic changes.
- Prefer unit tests for sync planners, state transitions, and error normalization.
- `pnpm run build` is the minimum broad check for code changes.
- Run `pnpm run lint` when a change affects structure, imports, or layering.
- If you skip a relevant check, say so in the change summary.

## 12. Documentation Expectations

- User-facing docs under `docs/` must stay bilingual.
- Update docs when behavior, workflows, or architectural constraints change.
- Prefer repository-specific guidance over sample-plugin boilerplate.
- Keep examples aligned with the current codebase.

## 13. Practical Do / Don't

Do:

- reuse the existing runtime and sync flows
- isolate provider-specific behavior in `provider/`
- keep lifecycle wiring minimal
- make retry and recovery logic obvious
- write code that survives reloads and partial failures

Don't:

- put provider-specific behavior into `sync/`
- add compatibility glue without an explicit requirement
- hide side effects in formatting helpers
- depend on raw message text for new runtime policy
- introduce broad abstractions that only one caller needs
