import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";

export function registerDriveSyncLogoutCommand(context: CommandContext) {
	const { plugin } = context;
	plugin.addCommand({
		id: "drive-sync-logout",
		name: "Sign out of remote provider",
		callback: async () => {
			const provider = plugin.getRemoteProvider();
			await provider.logout();
			plugin.clearStoredRemoteSession();
			await plugin.saveSettings();
			provider.disconnect();
			new Notice(`Signed out of ${provider.label}.`);
		},
	});
}
