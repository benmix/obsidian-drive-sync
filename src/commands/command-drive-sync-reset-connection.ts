import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";

export function registerDriveSyncResetConnectionCommand(context: CommandContext) {
	const { plugin } = context;
	plugin.addCommand({
		id: "drive-sync-reset-connection",
		name: "Reset remote connection",
		callback: () => {
			const provider = plugin.getRemoteProvider();
			provider.disconnect();
			new Notice(`${provider.label} connection reset.`);
		},
	});
}
