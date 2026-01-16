import {App, PluginSettingTab, Setting} from "obsidian";
import ProtonDriveSyncPlugin from "./main";

export interface ProtonDriveSettings {
	enableProtonDrive: boolean;
	sdkOptionsJson: string;
	remoteFolderId: string;
	sessionToken: string;
	accountEmail: string;
	autoSyncEnabled: boolean;
	autoSyncIntervalMs: number;
	localChangeDebounceMs: number;
}

export const DEFAULT_SETTINGS: ProtonDriveSettings = {
	enableProtonDrive: false,
	sdkOptionsJson: "",
	remoteFolderId: "",
	sessionToken: "",
	accountEmail: "",
	autoSyncEnabled: false,
	autoSyncIntervalMs: 300000,
	localChangeDebounceMs: 800
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
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.enableProtonDrive)
					.onChange(async (value) => {
						this.plugin.settings.enableProtonDrive = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Proton Drive SDK options (JSON)")
			.setDesc(
				"Paste the SDK options JSON required by @protontech/drive-sdk. Session tokens are merged automatically."
			)
			.addTextArea(text =>
				text
					.setPlaceholder('{\n  "sessionToken": "..."\n}')
					.setValue(this.plugin.settings.sdkOptionsJson)
					.onChange(async (value) => {
						this.plugin.settings.sdkOptionsJson = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Proton Drive session")
			.setDesc(this.plugin.settings.accountEmail
				? `Signed in as ${this.plugin.settings.accountEmail}.`
				: "Sign in from the command palette to store a session token locally."
			)
			.addButton(button => {
				button.setButtonText("Clear session");
				button.onClick(async () => {
					this.plugin.settings.sessionToken = "";
					this.plugin.settings.accountEmail = "";
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Remote folder ID")
			.setDesc("Target Proton Drive folder ID to sync your vault.")
			.addText(text =>
				text
					.setPlaceholder("folder-id")
					.setValue(this.plugin.settings.remoteFolderId)
					.onChange(async (value) => {
						this.plugin.settings.remoteFolderId = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Enable auto sync")
			.setDesc("Schedule periodic sync checks and respond to local changes.")
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.autoSyncEnabled)
					.onChange(async (value) => {
						this.plugin.settings.autoSyncEnabled = value;
						await this.plugin.saveSettings();
						this.plugin.refreshAutoSync();
					})
			);

		new Setting(containerEl)
			.setName("Auto sync interval (ms)")
			.setDesc("How often to poll Proton Drive when auto sync is enabled.")
			.addText(text =>
				text
					.setPlaceholder("300000")
					.setValue(String(this.plugin.settings.autoSyncIntervalMs))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						if (!Number.isNaN(parsed)) {
							this.plugin.settings.autoSyncIntervalMs = Math.max(60000, parsed);
							await this.plugin.saveSettings();
							this.plugin.refreshAutoSync();
						}
					})
			);

		new Setting(containerEl)
			.setName("Local change debounce (ms)")
			.setDesc("Delay before reacting to local file changes.")
			.addText(text =>
				text
					.setPlaceholder("800")
					.setValue(String(this.plugin.settings.localChangeDebounceMs))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						if (!Number.isNaN(parsed)) {
							this.plugin.settings.localChangeDebounceMs = Math.max(100, parsed);
							await this.plugin.saveSettings();
							this.plugin.refreshAutoSync();
						}
					})
			);
	}
}
