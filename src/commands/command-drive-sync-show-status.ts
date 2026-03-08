import type { CommandContext } from "../contracts/plugin/command-context";
import { SyncStatusModal } from "../ui/status-modal";

export function registerDriveSyncShowStatusCommand(context: CommandContext) {
	const { plugin } = context;
	plugin.addCommand({
		id: "drive-sync-show-status",
		name: "Show sync status",
		callback: () => {
			new SyncStatusModal(plugin.app, plugin).open();
		},
	});
}
