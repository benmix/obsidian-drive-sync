import { PluginSettingTab, Setting } from "obsidian";
import type { App } from "obsidian";

import type { ObsidianDriveSyncPluginApi } from "../contracts/plugin/plugin-api";
import type { DriveSyncSettings } from "../contracts/plugin/settings";
import { normalizeUnknownDriveSyncError, translateDriveSyncErrorUserMessage } from "../errors";
import { tr, trAny } from "../i18n";

import { openProviderLoginModal, openRemoteLoginModal } from "./auth-required-modal";
import { renderProviderIcon } from "./provider-icon";
import { RemoteFolderPickerModal } from "./remote-root-modal";

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
		const hasAuthSession = this.plugin.hasRemoteAuthSession();

		const accountSetting = new Setting(containerEl)
			.setName(tr("settings.remoteAccount"))
			.setDesc("");
		accountSetting.settingEl.addClass("drive-sync-account-setting");
		const accountStatus = accountSetting.descEl.createDiv({
			cls: "drive-sync-account-status",
			text: this.getAuthStatusText(),
		});
		const authPaused = this.plugin.isAuthPaused();
		if (hasAuthSession) {
			const providerChip = accountSetting.nameEl.createSpan({
				cls: "drive-sync-account-provider",
			});
			renderProviderIcon(providerChip, provider.id, provider.label);
			providerChip.createSpan({
				cls: "drive-sync-account-provider-label",
				text: provider.label,
			});
			const accountEmail = this.plugin.getRemoteAccountEmail();
			if (accountEmail) {
				accountSetting.nameEl.createSpan({
					cls: "drive-sync-account-user",
					text: tr("settings.accountChip", {
						email: accountEmail,
					}),
				});
			}
		}
		if (authPaused) {
			accountSetting.settingEl.addClass("drive-sync-setting-callout", "is-auth-warning");
			accountStatus.addClass("is-error");
		}
		if (hasAuthSession) {
			accountSetting.addButton((button) => {
				button.setButtonText(tr("settings.signOut"));
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
			accountSetting.settingEl.addClass("drive-sync-setting-callout");
			this.renderProviderLoginOptions(accountSetting.controlEl);
		}

		const remoteFolderPath = this.plugin.getRemoteScopePath();
		const remoteScopeId = this.plugin.getRemoteScopeId();
		const remotePathLabel = remoteFolderPath
			? remoteFolderPath
			: remoteScopeId
				? tr("settings.remoteFolderPath.idConfigured")
				: tr("settings.remoteFolderPath.notSelected");
		const remoteFolderSetting = new Setting(containerEl)
			.setName(tr("settings.remoteFolder"))
			.setDesc(tr("settings.remoteFolderDesc"))
			.addText((text) => text.setValue(remotePathLabel).setDisabled(true))
			.addButton((button) => {
				button.setButtonText(tr("settings.remoteFolderChoose"));
				button.onClick(() => {
					void this.openRemoteFolderPicker();
				});
			});
		const remoteValidationStatus = remoteFolderSetting.descEl.createDiv({
			cls: "drive-sync-remote-validation-status",
		});
		void this.autoValidateRemoteFolder(remoteValidationStatus);

		const builtInExcludePatterns = this.plugin.getBuiltInExcludePatterns();
		new Setting(containerEl).setName(tr("settings.excludedPaths")).setDesc(
			builtInExcludePatterns.length > 0
				? tr("settings.builtInRules", {
						rules: builtInExcludePatterns.join(", "),
					})
				: tr("settings.noBuiltInRules"),
		);

		new Setting(containerEl)
			.setName(tr("settings.syncStrategy"))
			.setDesc(tr("settings.syncStrategyDesc"))
			.addDropdown((dropdown) =>
				dropdown
					.addOption("bidirectional", tr("settings.syncStrategy.bidirectional"))
					.addOption("local_win", tr("settings.syncStrategy.localWin"))
					.addOption("remote_win", tr("settings.syncStrategy.remoteWin"))
					.setValue(this.plugin.settings.syncStrategy)
					.onChange(async (value) => {
						this.plugin.updateSettings({
							syncStrategy: value as DriveSyncSettings["syncStrategy"],
						});
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(tr("settings.autoSync"))
			.setDesc(tr("settings.autoSyncDesc"))
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
			.setName(tr("settings.networkPolicy"))
			.setDesc(tr("settings.networkPolicyDesc"))
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
			return tr("settings.authStatus.pendingValidation");
		}
		if (this.plugin.hasRemoteAuthSession()) {
			return tr("settings.authStatus.signedIn");
		}
		if (this.plugin.isAuthPaused()) {
			return (
				this.plugin.getLastAuthError() ?? tr("settings.authStatus.needsAttentionCommand")
			);
		}
		if (this.plugin.getStoredProviderCredentials()) {
			return tr("settings.authStatus.needsAttention");
		}
		return tr("settings.authStatus.signInHint");
	}

	private renderProviderLoginOptions(containerEl: HTMLElement): void {
		const providers = this.plugin.listRemoteProviders();
		const optionGrid = containerEl.createDiv({
			cls: "drive-sync-settings-provider-grid",
		});
		for (const provider of providers) {
			const button = optionGrid.createEl("button", {
				cls: "drive-sync-settings-provider-option",
			});
			renderProviderIcon(
				button,
				provider.id,
				provider.label,
				"drive-sync-provider-icon drive-sync-settings-provider-option-icon",
			);
			button.setAttribute(
				"aria-label",
				tr("settings.signInToProviderTooltip", {
					provider: provider.label,
				}),
			);
			button.addEventListener("click", () => {
				void openProviderLoginModal(this.plugin, provider.id, {
					onCancel: () => {
						this.display();
					},
					onSuccess: () => {
						this.display();
					},
				});
			});
		}
	}

	private async openRemoteFolderPicker(): Promise<void> {
		const provider = this.plugin.getRemoteProvider();
		if (!this.plugin.getStoredProviderCredentials() && !provider.getSession()) {
			openRemoteLoginModal(this.plugin, {
				onCancel: () => {
					this.display();
				},
				onSuccess: () => {
					const modal = new RemoteFolderPickerModal(this.app, this.plugin);
					modal.onClose = () => {
						this.display();
					};
					modal.open();
				},
			});
			return;
		}
		const modal = new RemoteFolderPickerModal(this.app, this.plugin);
		modal.onClose = () => {
			this.display();
		};
		modal.open();
	}

	private async autoValidateRemoteFolder(statusEl: HTMLDivElement): Promise<void> {
		const requestId = ++this.remoteValidationSequence;
		statusEl.setText(tr("settings.validation.checking"));
		const result = await this.validateRemoteFolder();
		if (requestId !== this.remoteValidationSequence || !statusEl.isConnected) {
			return;
		}
		statusEl.setText(
			tr("settings.validation.result", {
				message: result.message,
			}),
		);
	}

	private async validateRemoteFolder(): Promise<{
		ok: boolean;
		message: string;
	}> {
		const scopeId = this.plugin.getRemoteScopeId();
		const provider = this.plugin.getRemoteProvider();
		if (!scopeId) {
			return {
				ok: false,
				message: tr("settings.validation.selectFolderFirst"),
			};
		}
		if (!this.plugin.getStoredProviderCredentials() && !provider.getSession()) {
			return {
				ok: false,
				message: tr("error.auth.signInFirst"),
			};
		}

		let client: unknown;
		try {
			client = await this.plugin.connectRemoteClient();
		} catch (error) {
			const normalized = normalizeUnknownDriveSyncError(error, {
				category: "provider",
				userMessage: tr("error.provider.unableToConnect"),
				userMessageKey: "error.provider.unableToConnect",
			});
			return {
				ok: false,
				message: translateDriveSyncErrorUserMessage(normalized, trAny),
			};
		}
		return await provider.validateScope(client, scopeId);
	}
}
