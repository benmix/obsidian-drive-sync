import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";

export function registerDriveSyncResetConnectionCommand(context: CommandContext) {
	const { plugin } = context;
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
