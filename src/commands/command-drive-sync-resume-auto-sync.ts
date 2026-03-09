import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";

export function registerDriveSyncResumeAutoSyncCommand(context: CommandContext) {
	const { plugin } = context;
	plugin.addCommand({
		id: "drive-sync-resume-auto-sync",
		name: tr("commands.resumeAutoSync.name"),
		callback: () => {
			plugin.resumeAutoSync();
			new Notice(tr("notice.autoSyncResumed"));
		},
	});
}
