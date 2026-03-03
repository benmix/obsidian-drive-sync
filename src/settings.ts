import { PluginSettingTab, Setting } from "obsidian";
import type { App } from "obsidian";
import { getBuiltInExcludePatterns } from "./sync/exclude";
import { ProtonDriveLoginModal } from "./ui/login-modal";
import { ProtonDriveRemoteFs } from "./sync/remote-fs";
import { ProtonDriveRemoteRootModal } from "./ui/remote-root-modal";
import ProtonDriveSyncPlugin from "./main";
import type { ProtonSession } from "./proton-drive/sdk-session";
import type { ReusableCredentials } from "./proton-drive/proton-auth/types";

export interface ProtonDriveSettings {
	remoteFolderId: string;
	remoteFolderPath: string;
	protonSession?: ReusableCredentials;
	accountEmail: string;
	hasAuthSession: boolean;
	conflictStrategy: "local-wins" | "remote-wins" | "manual";
	autoSyncEnabled: boolean;
}

export const DEFAULT_SETTINGS: ProtonDriveSettings = {
	remoteFolderId: "",
	remoteFolderPath: "",
	protonSession: undefined,
	accountEmail: "",
	hasAuthSession: false,
	conflictStrategy: "local-wins",
	autoSyncEnabled: false,
};

export class ProtonDriveSettingTab extends PluginSettingTab {
	plugin: ProtonDriveSyncPlugin;
	private remoteValidationSequence = 0;

	constructor(app: App, plugin: ProtonDriveSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		const accountSetting = new Setting(containerEl)
			.setName("Proton Drive account")
			.setDesc(this.getAuthStatusText());
		if (this.plugin.settings.hasAuthSession) {
			accountSetting.addButton((button) => {
				button.setButtonText("Sign out");
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
		} else {
			accountSetting.addButton((button) => {
				button.setButtonText("Sign in");
				button.setCta();
				button.onClick(() => {
					const modal = new ProtonDriveLoginModal(this.app, this.plugin);
					modal.onClose = () => {
						this.display();
					};
					modal.open();
				});
			});
		}

		const remoteFolderPath = this.plugin.settings.remoteFolderPath.trim();
		const remoteFolderId = this.plugin.settings.remoteFolderId.trim();
		const remotePathLabel = remoteFolderPath
			? remoteFolderPath
			: remoteFolderId
				? "(legacy ID configured, reselect to show path)"
				: "(not selected)";
		const remoteFolderSetting = new Setting(containerEl)
			.setName("Remote folder")
			.setDesc("Choose the target Proton Drive folder path. Validation runs automatically.")
			.addText((text) => text.setValue(remotePathLabel).setDisabled(true))
			.addButton((button) => {
				button.setButtonText("Choose folder");
				button.onClick(() => {
					const modal = new ProtonDriveRemoteRootModal(this.app, this.plugin);
					modal.onClose = () => {
						this.display();
					};
					modal.open();
				});
			});
		const remoteValidationStatus = remoteFolderSetting.descEl.createDiv({
			cls: "protondrive-remote-validation-status",
		});
		void this.autoValidateRemoteFolder(remoteValidationStatus);

		const builtInExcludePatterns = getBuiltInExcludePatterns();
		new Setting(containerEl)
			.setName("Excluded paths")
			.setDesc(
				builtInExcludePatterns.length > 0
					? `Built-in rules: ${builtInExcludePatterns.join(", ")}`
					: "No built-in exclude rules.",
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
	}

	private getAuthStatusText(): string {
		if (this.plugin.settings.hasAuthSession && !this.plugin.authService.isSessionValidated()) {
			return "Session stored. Validation pending.";
		}
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
		return "Sign in here to store a session locally.";
	}

	private async autoValidateRemoteFolder(statusEl: HTMLDivElement): Promise<void> {
		const requestId = ++this.remoteValidationSequence;
		statusEl.setText("Validation: checking...");
		const result = await this.validateRemoteFolder();
		if (requestId !== this.remoteValidationSequence || !statusEl.isConnected) {
			return;
		}
		statusEl.setText(`Validation: ${result.message}`);
	}

	private async validateRemoteFolder(): Promise<{
		ok: boolean;
		message: string;
	}> {
		if (!this.plugin.settings.remoteFolderId.trim()) {
			return { ok: false, message: "Select a folder first." };
		}
		if (!this.plugin.settings.protonSession || !this.plugin.settings.hasAuthSession) {
			return { ok: false, message: "Sign in to Proton Drive first." };
		}

		const session = this.plugin.authService.getSession();
		if (!session) {
			return { ok: false, message: "Sign in to Proton Drive first." };
		}
		const activeSession: ProtonSession = { ...session };
		activeSession.onTokenRefresh = async () => {
			try {
				await this.plugin.authService.refreshToken();
				const refreshedSession = this.plugin.authService.getSession();
				if (refreshedSession) {
					Object.assign(activeSession, refreshedSession);
				}
				this.plugin.settings.protonSession =
					this.plugin.authService.getReusableCredentials();
				this.plugin.settings.hasAuthSession = true;
				await this.plugin.saveSettings();
			} catch (refreshError) {
				console.warn("Failed to refresh Proton session.", refreshError);
				this.plugin.settings.hasAuthSession = false;
				await this.plugin.saveSettings();
			}
		};
		const client = await this.plugin.protonDriveService.connect(activeSession);
		if (!client) {
			return { ok: false, message: "Unable to connect to Proton Drive." };
		}

		try {
			const remoteFs = new ProtonDriveRemoteFs(client, this.plugin.settings.remoteFolderId);
			const node = await remoteFs.getNode?.(this.plugin.settings.remoteFolderId);
			if (!node) {
				return { ok: false, message: "Folder not found." };
			}
			if (node.type !== "folder") {
				return { ok: false, message: "Selected node is not a folder." };
			}
			return { ok: true, message: "OK" };
		} catch (error) {
			console.warn("Remote folder validation failed.", error);
			return { ok: false, message: "Failed to validate folder." };
		}
	}
}
