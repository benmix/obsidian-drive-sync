import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";

export function registerDriveSyncConnectCommand(context: CommandContext) {
	const { plugin, requireConnectedRemoteClient } = context;
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
}
