import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";

export function registerDriveSyncLogoutCommand(context: CommandContext) {
	const { plugin } = context;
	plugin.addCommand({
		id: "drive-sync-logout",
		name: tr("commands.logout.name"),
		callback: async () => {
			const provider = plugin.getRemoteProvider();
			await provider.logout();
			plugin.clearStoredRemoteSession();
			await plugin.saveSettings();
			provider.disconnect();
			new Notice(
				tr("notice.signedOutOfProvider", {
					provider: provider.label,
				}),
			);
		},
	});
}
