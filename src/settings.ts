import { App, PluginSettingTab, Setting } from "obsidian";
import ProtonDriveSyncPlugin from "./main";
import { ProtonDriveRemoteRootModal } from "./ui/remote-root-modal";
import { compileExcludeRules, previewExcludedPaths, validateExcludePatterns } from "./sync/exclude";
import { normalizePath } from "./sync/utils";

export interface ProtonDriveSettings {
	enableProtonDrive: boolean;
	remoteFolderId: string;
	protonSession?: Record<string, unknown>;
	accountEmail: string;
	hasAuthSession: boolean;
	excludePatterns: string;
	conflictStrategy: "local-wins" | "remote-wins" | "manual";
	autoSyncEnabled: boolean;
	autoSyncIntervalMs: number;
	localChangeDebounceMs: number;
	maxConcurrentJobs: number;
	maxRetryAttempts: number;
}

export const DEFAULT_SETTINGS: ProtonDriveSettings = {
	enableProtonDrive: false,
	remoteFolderId: "",
	protonSession: undefined,
	accountEmail: "",
	hasAuthSession: false,
	excludePatterns: "",
	conflictStrategy: "local-wins",
	autoSyncEnabled: false,
	autoSyncIntervalMs: 300000,
	localChangeDebounceMs: 800,
	maxConcurrentJobs: 2,
	maxRetryAttempts: 5,
};

export class ProtonDriveSettingTab extends PluginSettingTab {
	plugin: ProtonDriveSyncPlugin;

	constructor(app: App, plugin: ProtonDriveSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Enable Proton Drive integration")
			.setDesc("Connect to Proton Drive only when you run a command.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.enableProtonDrive).onChange(async (value) => {
					this.plugin.settings.enableProtonDrive = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Proton Drive session")
			.setDesc(this.getAuthStatusText())
			.addButton((button) => {
				button.setButtonText("Clear session");
				button.onClick(async () => {
					this.plugin.settings.protonSession = undefined;
					this.plugin.settings.accountEmail = "";
					this.plugin.settings.hasAuthSession = false;
					await this.plugin.authService.logout();
					this.plugin.protonDriveService.disconnect();
					await this.plugin.saveSettings();
					this.display();
				});
			});

		new Setting(containerEl)
			.setName("Remote folder ID")
			.setDesc("Target Proton Drive folder ID to sync your vault.")
			.addText((text) =>
				text
					.setPlaceholder("folder-id")
					.setValue(this.plugin.settings.remoteFolderId)
					.onChange(async (value) => {
						this.plugin.settings.remoteFolderId = value;
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl)
			.setName("Browse remote folders")
			.setDesc("Select a folder from Proton Drive instead of pasting an ID.")
			.addButton((button) => {
				button.setButtonText("Choose folder");
				button.onClick(() => {
					new ProtonDriveRemoteRootModal(this.app, this.plugin).open();
				});
			});

		new Setting(containerEl)
			.setName("Exclude paths")
			.setDesc(
				"One pattern per line. Supports '*' and '**' wildcards. Exact paths also exclude descendants.",
			)
			.addTextArea((text) =>
				text
					.setPlaceholder(".obsidian/\n*.tmp\nattachments/private/")
					.setValue(this.plugin.settings.excludePatterns)
					.onChange(async (value) => {
						this.plugin.settings.excludePatterns = value;
						await this.plugin.saveSettings();
					}),
			);
		const excludeValidation = validateExcludePatterns(this.plugin.settings.excludePatterns);
		if (excludeValidation.invalid.length > 0) {
			const invalidSetting = new Setting(containerEl)
				.setName("Exclude pattern errors")
				.setDesc("Fix these patterns to avoid unexpected sync behavior.");
			const list = invalidSetting.descEl.createEl("ul");
			for (const item of excludeValidation.invalid) {
				list.createEl("li", { text: item });
			}
		}

		const previewSetting = new Setting(containerEl)
			.setName("Exclude preview")
			.setDesc("Preview which paths are excluded (comma-separated list).");
		let previewInput = "";
		const previewOutput = previewSetting.descEl.createDiv({
			cls: "protondrive-exclude-preview",
		});
		previewOutput.setText("No paths to preview.");
		previewSetting.addText((text) =>
			text.setPlaceholder("notes/draft.md, .obsidian/config").onChange((value) => {
				previewInput = value;
				const entries = previewInput
					.split(",")
					.map((item) => normalizePath(item.trim()))
					.filter((item) => item.length > 0);
				if (entries.length === 0) {
					previewOutput.setText("No paths to preview.");
					return;
				}
				const rules = compileExcludeRules(this.plugin.settings.excludePatterns);
				const excluded = previewExcludedPaths(entries, rules);
				if (excluded.length === 0) {
					previewOutput.setText("No paths are excluded.");
					return;
				}
				previewOutput.setText(`Excluded: ${excluded.join(", ")}`);
			}),
		);

		new Setting(containerEl)
			.setName("Conflict strategy")
			.setDesc("Choose how to resolve changes when both sides changed.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("local-wins", "Local wins (default)")
					.addOption("remote-wins", "Remote wins")
					.addOption("manual", "Manual (pause and notify)")
					.setValue(this.plugin.settings.conflictStrategy)
					.onChange(async (value) => {
						this.plugin.settings.conflictStrategy =
							value as ProtonDriveSettings["conflictStrategy"];
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Enable auto sync")
			.setDesc("Schedule periodic sync checks and respond to local changes.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoSyncEnabled).onChange(async (value) => {
					this.plugin.settings.autoSyncEnabled = value;
					await this.plugin.saveSettings();
					this.plugin.refreshAutoSync();
				}),
			);

		new Setting(containerEl)
			.setName("Max concurrent jobs")
			.setDesc("Limits parallel sync operations (1-4 recommended).")
			.addText((text) =>
				text
					.setPlaceholder("2")
					.setValue(String(this.plugin.settings.maxConcurrentJobs))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						if (!Number.isNaN(parsed)) {
							this.plugin.settings.maxConcurrentJobs = Math.min(
								4,
								Math.max(1, parsed),
							);
							await this.plugin.saveSettings();
						}
					}),
			);
		new Setting(containerEl)
			.setName("Max retry attempts")
			.setDesc("How many times to retry failed jobs before giving up.")
			.addText((text) =>
				text
					.setPlaceholder("5")
					.setValue(String(this.plugin.settings.maxRetryAttempts))
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						if (!Number.isNaN(parsed)) {
							this.plugin.settings.maxRetryAttempts = Math.min(
								10,
								Math.max(1, parsed),
							);
							await this.plugin.saveSettings();
						}
					}),
			);

		new Setting(containerEl)
			.setName("Auto sync interval (ms)")
			.setDesc("How often to poll Proton Drive when auto sync is enabled.")
			.addText((text) =>
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
					}),
			);

		new Setting(containerEl)
			.setName("Local change debounce (ms)")
			.setDesc("Delay before reacting to local file changes.")
			.addText((text) =>
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
					}),
			);
	}

	private getAuthStatusText(): string {
		if (this.plugin.settings.hasAuthSession) {
			return this.plugin.settings.accountEmail
				? `Signed in as ${this.plugin.settings.accountEmail}.`
				: "Signed in to Proton Drive.";
		}
		if (this.plugin.settings.protonSession) {
			return "Session needs attention. Sign in again to restore access.";
		}
		if (this.plugin.isAuthPaused()) {
			return (
				this.plugin.getLastAuthError() ??
				"Session needs attention. Sign in again from the command palette."
			);
		}
		return "Sign in from the command palette to store a session locally.";
	}
}
