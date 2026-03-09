import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";
import { restoreVaultFromRemote } from "../runtime/use-cases/sync-workflows";

export function registerDriveSyncRestoreVaultCommand(context: CommandContext) {
	const { plugin, localProvider, runRemoteCommand, showCommandError } = context;
	plugin.addCommand({
		id: "drive-sync-restore-vault",
		name: tr("commands.restoreVault.name"),
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
					new Notice(
						tr("notice.downloadedFilesFromProvider", {
							count: result.downloaded,
							provider: provider.label,
						}),
					);
				} catch (error) {
					showCommandError(error, {
						logMessage: "Vault restore failed.",
						noticeKey: "notice.vaultRestoreFailed",
					});
				}
			});
		},
	});
}
