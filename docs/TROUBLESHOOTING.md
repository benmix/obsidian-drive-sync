# Troubleshooting

This guide lists common failure cases and the first checks worth doing before deeper debugging.

## 1. Plugin does not load after build

Check:

- `dist/` contains the built plugin files
- the build output was linked or copied into `<Vault>/.obsidian/plugins/<plugin-id>/`
- `manifest.json` still matches the plugin folder and plugin ID

Recommended actions:

1. Run `pnpm run build`.
2. Re-link with `pnpm run link:obsidian -- --vault "/path/to/YourVault"` or copy the files manually.
3. Reload Obsidian and confirm the plugin appears in Community Plugins.

## 2. Build output is missing

Check:

- `pnpm install` completed successfully
- TypeScript or Vite errors were fixed instead of ignored
- `dist/` includes `main.js`, `manifest.json`, and `styles.css`

Recommended actions:

1. Run `pnpm run build`.
2. Fix the reported build errors first.
3. Re-check `dist/` before debugging runtime behavior.

## 3. Commands do not appear

Check:

- command registration still runs during plugin startup
- command IDs are still unique and stable
- the plugin loaded at all instead of failing earlier in startup

Recommended actions:

1. Confirm the plugin is enabled.
2. Open the Obsidian developer console and inspect startup errors.
3. Confirm `src/commands/index.ts` still registers the expected commands.

## 4. Settings do not persist

Check:

- `loadData()` and `saveData()` are awaited
- a later write is not overwriting the earlier change
- the settings UI refreshes after the state update

Recommended actions:

1. Save a settings change.
2. Reload the plugin or restart Obsidian.
3. Confirm the stored value is read back correctly.

## 5. Status UI looks inconsistent

Check:

- runtime state, persisted state, and rendered status use the same semantics
- auth pause, sync activity, and error display come from the right source of truth
- presentation logic was updated when state behavior changed

Recommended actions:

1. Reproduce the state transition.
2. Compare runtime state, persisted state, and rendered output.
3. Fix the ownership boundary instead of patching only the UI.

## 6. Desktop-only behavior leaked into shared code

Check:

- the feature is intentionally desktop-only
- the behavior is isolated from provider-agnostic sync logic
- `manifest.json` still reflects the intended platform support

Recommended actions:

1. Move desktop-specific behavior behind a runtime or provider boundary.
2. Re-check `manifest.json` and the related docs.
3. Re-test the affected flow under the expected platform assumptions.

## 7. Sync behavior does not match the intended strategy

Check:

- whether the vault is still in initialization phase or already in runtime sync
- the configured `syncStrategy`
- whether `conflict_pending`, tombstones, or remote-missing confirmation rules apply

Recommended actions:

1. Read [`SYNC_INITIALIZATION_STRATEGY.md`](./SYNC_INITIALIZATION_STRATEGY.md) for first-sync cases.
2. Read [`SYNC_STRATEGY.md`](./SYNC_STRATEGY.md) for runtime cases.
3. Verify the planner logic, not only the executed job list.

## 8. Diagnostics are missing useful detail

Check:

- the failure was normalized into a `DriveSyncError`
- logs contain `code`, `category`, and useful context fields
- redaction removed secrets but not the information needed for debugging

Recommended actions:

1. Inspect [`ERROR_SYSTEM_DESIGN.md`](./ERROR_SYSTEM_DESIGN.md).
2. Add context through structured fields instead of longer free-form messages.
3. Preserve the chain from normalized error to persisted log and UI message.
