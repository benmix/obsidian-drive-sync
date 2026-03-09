import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { tr } from "../i18n";
import { DriveSyncSettingTab } from "../ui/settings-tab";

export function registerDriveSyncOpenSettingsCommand(context: CommandContext) {
	const { plugin } = context;

	plugin.addSettingTab(new DriveSyncSettingTab(plugin.app, plugin));

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
