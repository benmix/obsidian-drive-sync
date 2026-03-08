import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";

export function registerDriveSyncAutoSyncNowCommand(context: CommandContext) {
	const { plugin, requireScopeId } = context;
	plugin.addCommand({
		id: "drive-sync-auto-sync-now",
		name: "Run auto sync now",
		callback: async () => {
			if (!requireScopeId()) {
				return;
			}
			try {
				await plugin.runAutoSync();
				new Notice("Auto sync completed.");
			} catch (error) {
				console.warn("Auto sync failed.", error);
				new Notice("Auto sync failed. Check the console for details.");
			}
		},
	});
}
