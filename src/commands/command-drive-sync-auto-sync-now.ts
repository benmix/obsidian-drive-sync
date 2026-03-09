import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";

export function registerDriveSyncAutoSyncNowCommand(context: CommandContext) {
	const { plugin, requireScopeId } = context;
	plugin.addCommand({
		id: "drive-sync-auto-sync-now",
		name: tr("commands.autoSyncNow.name"),
		callback: async () => {
			if (!requireScopeId()) {
				return;
			}
			try {
				await plugin.runAutoSync();
				new Notice(tr("notice.autoSyncCompleted"));
			} catch (error) {
				console.warn("Auto sync failed.", error);
				new Notice(tr("notice.autoSyncFailed"));
			}
		},
	});
}
