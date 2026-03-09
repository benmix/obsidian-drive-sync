# Troubleshooting

## 1. Plugin does not load after build

Checks:

- Verify the built plugin files exist under `dist/`.
- Verify the plugin bundle has been linked or copied into `<Vault>/.obsidian/plugins/<plugin-id>/`.
- Verify `manifest.json` still matches the plugin folder and expected plugin ID.

Recommended action:

1. Run `pnpm run build`.
2. Re-link the plugin with `pnpm run link:obsidian -- --vault "/path/to/YourVault"` or copy the built files manually.
3. Reload Obsidian and check whether the plugin appears in Community Plugins.

## 2. Build output is missing

Checks:

- Verify `pnpm install` completed successfully.
- Verify TypeScript and Vite build errors were resolved instead of ignored.
- Verify `dist/` contains `main.js`, `manifest.json`, and `styles.css` when applicable.

Recommended action:

1. Run `pnpm run build`.
2. Fix the reported TypeScript or bundling errors first.
3. Re-check the `dist/` output before debugging runtime behavior.

## 3. Commands do not appear

Checks:

- Verify command registration still happens during plugin startup.
- Verify command IDs remain unique and stable.
- Verify the plugin actually loaded instead of failing earlier in startup.

Recommended action:

1. Confirm the plugin is enabled in Obsidian.
2. Inspect startup errors in the Obsidian developer console.
3. Confirm command registration still occurs after recent refactors.

## 4. Settings do not persist

Checks:

- Verify `loadData()` and `saveData()` are awaited.
- Verify settings writes are not being overwritten later in the same flow.
- Verify the settings UI re-renders after state changes.

Recommended action:

1. Save a setting change.
2. Reload the plugin or restart Obsidian.
3. Confirm the value was persisted and read back correctly.

## 5. Status UI looks inconsistent

Checks:

- Verify runtime state, persisted state, and rendered status UI use the same semantics.
- Verify auth pause, sync activity, and error display are derived from the correct source of truth.
- Verify presentation logic was updated when state behavior changed.

Recommended action:

1. Reproduce the state transition.
2. Compare runtime state, persisted state, and rendered status output.
3. Fix the mismatch at the ownership boundary instead of patching only the UI.

## 6. Desktop-only behavior leaks into shared code

Checks:

- Verify the feature is intentionally desktop-only.
- Verify the behavior is isolated from provider-agnostic and shared sync logic.
- Verify `manifest.json` reflects the intended platform support.

Recommended action:

1. Move desktop-only behavior behind a runtime boundary if it leaked into shared modules.
2. Re-check `manifest.json` and related documentation.
3. Re-test the affected code path under the expected platform assumptions.
