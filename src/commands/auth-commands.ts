import type { CommandContext } from "@contracts/plugin/command-context";
import { tr } from "@i18n";
import { openRemoteLoginModal } from "@ui/auth-required-modal";
import { Notice } from "obsidian";

export function registerAuthCommands(context: CommandContext): void {
	const { plugin, requireConnectedRemoteClient, showCommandError } = context;

	plugin.addCommand({
		id: "drive-sync-connect",
		name: tr("commands.connect.name"),
		callback: async () => {
			const connection = await requireConnectedRemoteClient();
			if (!connection) {
				return;
			}
			new Notice(
				tr("notice.connectedToProvider", {
					provider: connection.provider.label,
				}),
			);
		},
	});

	plugin.addCommand({
		id: "drive-sync-login",
		name: tr("commands.login.name"),
		callback: () => {
			openRemoteLoginModal(plugin);
		},
	});

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

	plugin.addCommand({
		id: "drive-sync-reset-connection",
		name: tr("commands.resetConnection.name"),
		callback: () => {
			const provider = plugin.getRemoteProvider();
			provider.disconnect();
			new Notice(
				tr("notice.providerConnectionReset", {
					provider: provider.label,
				}),
			);
		},
	});
}
