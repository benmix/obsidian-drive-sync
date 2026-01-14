import {Plugin} from "obsidian";
import {registerCommands} from "./commands";
import {ProtonDriveAuthService} from "./protonDrive/auth";
import {ProtonDriveService} from "./protonDrive/service";
import {DEFAULT_SETTINGS, ProtonDriveSettings, ProtonDriveSettingTab} from "./settings";

export default class ProtonDriveSyncPlugin extends Plugin {
	settings: ProtonDriveSettings;
	authService: ProtonDriveAuthService;
	protonDriveService: ProtonDriveService;

	async onload() {
		await this.loadSettings();

		this.authService = new ProtonDriveAuthService();
		this.protonDriveService = new ProtonDriveService();

		registerCommands(this);
		this.addSettingTab(new ProtonDriveSettingTab(this.app, this));
	}

	onunload() {
		this.protonDriveService?.disconnect();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ProtonDriveSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
