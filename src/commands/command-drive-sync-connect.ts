import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";

export function registerDriveSyncConnectCommand(context: CommandContext) {
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
}
