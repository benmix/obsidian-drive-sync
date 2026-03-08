import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";

export function registerDriveSyncPauseAutoSyncCommand(context: CommandContext) {
	const { plugin } = context;
	plugin.addCommand({
		id: "drive-sync-pause-auto-sync",
		name: "Pause auto sync",
		callback: () => {
			plugin.pauseAutoSync();
			new Notice("Auto sync paused.");
		},
	});
}
