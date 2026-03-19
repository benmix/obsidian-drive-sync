import type { CommandContext } from "@contracts/plugin/command-context";
import { tr } from "@i18n";
import { Notice } from "obsidian";

export function registerDriveSyncLogoutCommand(context: CommandContext) {
	const { plugin, showCommandError } = context;
	plugin.addCommand({
		id: "drive-sync-logout",
		name: tr("commands.logout.name"),
		callback: async () => {
			const provider = plugin.getRemoteProvider();
			try {
				await provider.logout();
				plugin.clearStoredRemoteSession();
				await plugin.saveSettings();
				provider.disconnect();
				new Notice(
					tr("notice.signedOutOfProvider", {
						provider: provider.label,
					}),
				);
			} catch (error) {
				showCommandError(error, {
					logMessage: "Provider logout failed.",
					noticeKey: "notice.signOutFailed",
				});
			}
		},
	});
}
