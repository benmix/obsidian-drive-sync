import type { CommandContext } from "@contracts/plugin/command-context";
import { tr } from "@i18n";
import { SyncConflictModal } from "@ui/conflict-modal";

export function registerDriveSyncReviewConflictsCommand(context: CommandContext) {
	const { plugin } = context;
	plugin.addCommand({
		id: "drive-sync-review-conflicts",
		name: tr("commands.reviewConflicts.name"),
		callback: () => {
			new SyncConflictModal(plugin.app, plugin).open();
		},
	});
}
