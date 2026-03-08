import { PluginSettingTab, Setting } from "obsidian";
import type { App } from "obsidian";

import type { ObsidianDriveSyncPluginApi } from "./contracts/plugin/plugin-api";
import type { DriveSyncSettings } from "./contracts/plugin/settings";
import { getBuiltInExcludePatterns } from "./sync/planner/exclude";
import { RemoteProviderLoginModal } from "./ui/login-modal";
import { RemoteFolderPickerModal } from "./ui/remote-root-modal";

export class DriveSyncSettingTab extends PluginSettingTab {
	plugin: ObsidianDriveSyncPluginApi;
	private remoteValidationSequence = 0;

	constructor(app: App, plugin: ObsidianDriveSyncPluginApi) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		const provider = this.plugin.getRemoteProvider();

		const accountSetting = new Setting(containerEl)
			.setName("Remote account")
			.setDesc(this.getAuthStatusText());
		if (this.plugin.hasRemoteAuthSession()) {
			accountSetting.addButton((button) => {
				button.setButtonText("Sign out");
				button.onClick(async () => {
					const provider = this.plugin.getRemoteProvider();
					await provider.logout();
					this.plugin.clearStoredRemoteSession();
					provider.disconnect();
					await this.plugin.saveSettings();
					this.display();
				});
			});
		} else {
			accountSetting.addButton((button) => {
				button.setButtonText("Sign in");
				button.setCta();
				button.onClick(() => {
					const modal = new RemoteProviderLoginModal(this.app, this.plugin);
					modal.onClose = () => {
						this.display();
					};
					modal.open();
				});
			});
		}

		const remoteFolderPath = this.plugin.getRemoteScopePath();
		const remoteFolderId = this.plugin.getRemoteScopeId();
		const remotePathLabel = remoteFolderPath
			? remoteFolderPath
			: remoteFolderId
				? "(ID configured, reselect to show path)"
				: "(not selected)";
		const remoteFolderSetting = new Setting(containerEl)
			.setName("Remote folder")
			.setDesc(
				`Choose the target ${provider.label} folder path. Validation runs automatically.`,
			)
			.addText((text) => text.setValue(remotePathLabel).setDisabled(true))
			.addButton((button) => {
				button.setButtonText("Choose folder");
				button.onClick(() => {
					const modal = new RemoteFolderPickerModal(this.app, this.plugin);
					modal.onClose = () => {
						this.display();
					};
					modal.open();
				});
			});
		const remoteValidationStatus = remoteFolderSetting.descEl.createDiv({
			cls: "drive-sync-remote-validation-status",
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
			.setName("Sync strategy")
			.setDesc("Choose direction/authority for automatic sync decisions.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("bidirectional", "Bidirectional (default)")
					.addOption("local_win", "Local authority")
					.addOption("remote_win", "Remote authority")
					.setValue(this.plugin.settings.syncStrategy)
					.onChange(async (value) => {
						this.plugin.updateSettings({
							syncStrategy: value as DriveSyncSettings["syncStrategy"],
						});
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Enable auto sync")
			.setDesc("Schedule periodic sync checks and respond to local changes.")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.autoSyncEnabled).onChange(async (value) => {
					this.plugin.updateSettings({
						autoSyncEnabled: value,
					});
					await this.plugin.saveSettings();
					this.plugin.refreshAutoSync();
				}),
			);

		new Setting(containerEl)
			.setName("Experimental: network policy")
			.setDesc(
				"Gate sync runs by online status and transient-network cooldown. Disabled by default.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableNetworkPolicy)
					.onChange(async (value) => {
						this.plugin.updateSettings({
							enableNetworkPolicy: value,
						});
						await this.plugin.saveSettings();
					}),
			);
	}

	private getAuthStatusText(): string {
		const provider = this.plugin.getRemoteProvider();
		if (this.plugin.hasRemoteAuthSession() && !provider.isSessionValidated()) {
			return "Session stored. Validation pending.";
		}
		if (this.plugin.hasRemoteAuthSession()) {
			const email = this.plugin.getRemoteAccountEmail();
			return email ? `Signed in as ${email}.` : `Signed in to ${provider.label}.`;
		}
		if (this.plugin.getStoredProviderCredentials()) {
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
		const scopeId = this.plugin.getRemoteScopeId();
		const provider = this.plugin.getRemoteProvider();
		if (!scopeId) {
			return { ok: false, message: "Select a folder first." };
		}
		if (!this.plugin.getStoredProviderCredentials() && !provider.getSession()) {
			return {
				ok: false,
				message: `Sign in to ${provider.label} first.`,
			};
		}

		const client = await this.plugin.connectRemoteClient();
		if (!client) {
			return {
				ok: false,
				message: `Unable to connect to ${provider.label}.`,
			};
		}
		return await provider.validateScope(client, scopeId);
	}
}
