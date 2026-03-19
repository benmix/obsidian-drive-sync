import type { CommandContext } from "@contracts/plugin/command-context";
import { tr } from "@i18n";
import { Notice } from "obsidian";

export function registerDriveSyncAutoSyncNowCommand(context: CommandContext) {
	const { plugin, requireScopeId, showCommandError } = context;
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
				showCommandError(error, {
					logMessage: "Auto sync failed.",
					noticeKey: "notice.autoSyncFailed",
				});
			}
		},
	});
}
