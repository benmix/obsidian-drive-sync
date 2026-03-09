import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";
import { SyncStatusModal } from "../ui/status-modal";

export function registerDriveSyncShowStatusCommand(context: CommandContext) {
	const { plugin } = context;
	plugin.addCommand({
		id: "drive-sync-show-status",
		name: tr("commands.showStatus.name"),
		callback: () => {
			new SyncStatusModal(plugin.app, plugin).open();
		},
	});
}
