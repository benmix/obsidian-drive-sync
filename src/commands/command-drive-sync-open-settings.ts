import { Notice } from "obsidian";

import type { CommandContext } from "../contracts/plugin/command-context";
import { DriveSyncSettingTab } from "../ui/settings-tab";

export function registerDriveSyncOpenSettingsCommand(context: CommandContext) {
	const { plugin } = context;

	plugin.addSettingTab(new DriveSyncSettingTab(plugin.app, plugin));

	plugin.addCommand({
		id: "drive-sync-open-settings",
		name: "Open plugin settings",
		callback: () => {
			const setting = (plugin.app as { setting?: unknown }).setting as
				| {
						open?: () => void;
						openTabById?: (id: string) => void;
				  }
				| undefined;
			if (!setting?.open || !setting.openTabById) {
				new Notice("Unable to open settings view.");
				return;
			}
			setting.open();
			setting.openTabById(plugin.manifest.id);
		},
	});
}
