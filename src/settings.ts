import {App, PluginSettingTab, Setting} from "obsidian";
import ProtonDriveSyncPlugin from "./main";

export interface ProtonDriveSettings {
	enableProtonDrive: boolean;
	sdkOptionsJson: string;
	remoteFolderId: string;
}

export const DEFAULT_SETTINGS: ProtonDriveSettings = {
	enableProtonDrive: false,
	sdkOptionsJson: "",
	remoteFolderId: ""
};

export class ProtonDriveSettingTab extends PluginSettingTab {
	plugin: ProtonDriveSyncPlugin;

	constructor(app: App, plugin: ProtonDriveSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Enable Proton Drive integration")
			.setDesc("Connect to Proton Drive only when you run a command.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableProtonDrive)
				.onChange(async (value) => {
					this.plugin.settings.enableProtonDrive = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Proton Drive SDK options (JSON)")
			.setDesc("Paste the SDK options JSON required by @protontech/drive-sdk, such as authentication details.")
			.addTextArea(text => text
				.setPlaceholder("{\n  \"sessionToken\": \"...\"\n}")
				.setValue(this.plugin.settings.sdkOptionsJson)
				.onChange(async (value) => {
					this.plugin.settings.sdkOptionsJson = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Remote folder ID")
			.setDesc("Target Proton Drive folder ID to sync your vault.")
			.addText(text => text
				.setPlaceholder("folder-id")
				.setValue(this.plugin.settings.remoteFolderId)
				.onChange(async (value) => {
					this.plugin.settings.remoteFolderId = value;
					await this.plugin.saveSettings();
				}));
	}
}
