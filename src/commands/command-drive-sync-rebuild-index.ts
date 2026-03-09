import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";
import { rebuildSyncIndex } from "../runtime/use-cases/sync-workflows";

export function registerDriveSyncRebuildIndexCommand(context: CommandContext) {
	const { plugin, localProvider, runRemoteCommand } = context;
	plugin.addCommand({
		id: "drive-sync-rebuild-index",
		name: tr("commands.rebuildIndex.name"),
		callback: async () => {
			await runRemoteCommand(async ({ provider, client, scopeId }) => {
				try {
					await rebuildSyncIndex(plugin.app, localProvider, provider, client, scopeId, {
						syncStrategy: plugin.settings.syncStrategy,
					});
					new Notice(tr("notice.indexRebuilt"));
				} catch (error) {
					console.warn("Index rebuild failed.", error);
					new Notice(tr("notice.indexRebuildFailed"));
				}
			});
		},
	});
}
