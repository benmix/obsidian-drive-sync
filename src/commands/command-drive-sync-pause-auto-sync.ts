import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";

export function registerDriveSyncPauseAutoSyncCommand(context: CommandContext) {
	const { plugin } = context;
	plugin.addCommand({
		id: "drive-sync-pause-auto-sync",
		name: tr("commands.pauseAutoSync.name"),
		callback: () => {
			plugin.pauseAutoSync();
			new Notice(tr("notice.autoSyncPaused"));
		},
	});
}
