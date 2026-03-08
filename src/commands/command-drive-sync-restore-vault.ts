import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { restoreVaultFromRemote } from "../runtime/use-cases/sync-workflows";

export function registerDriveSyncRestoreVaultCommand(context: CommandContext) {
	const { plugin, localProvider, runRemoteCommand } = context;
	plugin.addCommand({
		id: "drive-sync-restore-vault",
		name: "Restore vault from remote",
		callback: async () => {
			await runRemoteCommand(async ({ provider, client, scopeId }) => {
				try {
					const result = await restoreVaultFromRemote(
						plugin.app,
						localProvider,
						provider,
						client,
						scopeId,
					);
					new Notice(`Downloaded ${result.downloaded} files from ${provider.label}.`);
				} catch (error) {
					console.warn("Vault restore failed.", error);
					new Notice("Vault restore failed. Check the console for details.");
				}
			});
		},
	});
}
