import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { syncVaultToRemote } from "../runtime/use-cases/sync-workflows";

export function registerDriveSyncSyncVaultCommand(context: CommandContext) {
	const { plugin, localProvider, runRemoteCommand } = context;
	plugin.addCommand({
		id: "drive-sync-sync-vault",
		name: "Sync vault to remote",
		callback: async () => {
			await runRemoteCommand(async ({ provider, client, scopeId }) => {
				try {
					const result = await syncVaultToRemote(
						plugin.app,
						localProvider,
						provider,
						client,
						scopeId,
					);
					new Notice(`Uploaded ${result.uploaded} files to ${provider.label}.`);
				} catch (error) {
					console.warn("Vault sync failed.", error);
					new Notice("Vault sync failed. Check the console for details.");
				}
			});
		},
	});
}
