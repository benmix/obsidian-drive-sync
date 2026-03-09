import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";
import { syncVaultToRemote } from "../runtime/use-cases/sync-workflows";

export function registerDriveSyncSyncVaultCommand(context: CommandContext) {
	const { plugin, localProvider, runRemoteCommand, showCommandError } = context;
	plugin.addCommand({
		id: "drive-sync-sync-vault",
		name: tr("commands.syncVault.name"),
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
					new Notice(
						tr("notice.uploadedFilesToProvider", {
							count: result.uploaded,
							provider: provider.label,
						}),
					);
				} catch (error) {
					showCommandError(error, {
						logMessage: "Vault sync failed.",
						noticeKey: "notice.vaultSyncFailed",
					});
				}
			});
		},
	});
}
