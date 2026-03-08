import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";

export function registerDriveSyncResumeAutoSyncCommand(context: CommandContext) {
	const { plugin } = context;
	plugin.addCommand({
		id: "drive-sync-resume-auto-sync",
		name: "Resume auto sync",
		callback: () => {
			plugin.resumeAutoSync();
			new Notice("Auto sync resumed.");
		},
	});
}
