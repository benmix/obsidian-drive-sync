import type { CommandContext } from "@contracts/plugin/command-context";
import { tr } from "@i18n";
import { SyncConflictModal } from "@ui/conflict-modal";
import { DriveSyncSettingTab } from "@ui/settings-tab";
import { SyncStatusModal } from "@ui/status-modal";
import { Notice } from "obsidian";

export function registerUiCommands(context: CommandContext): void {
	const { plugin } = context;

	plugin.addSettingTab(new DriveSyncSettingTab(plugin.app, plugin));

	plugin.addCommand({
		id: "drive-sync-review-conflicts",
		name: tr("commands.reviewConflicts.name"),
		callback: () => {
			new SyncConflictModal(plugin.app, plugin).open();
		},
	});

	plugin.addCommand({
		id: "drive-sync-show-status",
		name: tr("commands.showStatus.name"),
		callback: () => {
			new SyncStatusModal(plugin.app, plugin).open();
		},
	});

	plugin.addCommand({
		id: "drive-sync-open-settings",
		name: tr("commands.openSettings.name"),
		callback: () => {
			const setting = (plugin.app as { setting?: unknown }).setting as
				| {
						open?: () => void;
						openTabById?: (id: string) => void;
				  }
				| undefined;
			if (!setting?.open || !setting.openTabById) {
				new Notice(tr("notice.openSettingsUnavailable"));
				return;
			}
			setting.open();
			setting.openTabById(plugin.manifest.id);
		},
	});
}
