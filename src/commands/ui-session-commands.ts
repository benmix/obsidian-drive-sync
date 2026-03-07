import type { CommandContext } from "./context";
import { Notice } from "obsidian";
import { RemoteProviderLoginModal } from "../ui/login-modal";
import { SyncConflictModal } from "../ui/conflict-modal";
import { SyncStatusModal } from "../ui/status-modal";

export function registerUiSessionCommands(context: CommandContext) {
	const { plugin, requireConnectedRemoteClient } = context;

	plugin.addCommand({
		id: "drive-sync-connect",
		name: "Connect remote provider",
		callback: async () => {
			const connection = await requireConnectedRemoteClient();
			if (!connection) {
				return;
			}
			new Notice(`Connected to ${connection.provider.label}.`);
		},
	});

	plugin.addCommand({
		id: "drive-sync-login",
		name: "Sign in to remote provider",
		callback: () => {
			new RemoteProviderLoginModal(plugin.app, plugin).open();
		},
	});

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

	plugin.addCommand({
		id: "drive-sync-review-conflicts",
		name: "Review sync conflicts",
		callback: () => {
			new SyncConflictModal(plugin.app, plugin).open();
		},
	});

	plugin.addCommand({
		id: "drive-sync-show-status",
		name: "Show sync status",
		callback: () => {
			new SyncStatusModal(plugin.app, plugin).open();
		},
	});
}
