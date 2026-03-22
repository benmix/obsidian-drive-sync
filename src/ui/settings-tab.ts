import type { PluginSettingsPanelPort } from "@contracts/plugin/plugin-ui-port";
import type { DriveSyncSettings } from "@contracts/plugin/settings";
import { tr } from "@i18n";
import { openProviderLoginModal, openRemoteLoginModal } from "@ui/auth-required-modal";
import { prepareDriveSyncErrorNotice } from "@ui/error-notice";
import { renderProviderIcon } from "@ui/provider-icon";
import { RemoteFolderPickerModal } from "@ui/remote-root-modal";
import { PluginSettingTab, Setting } from "obsidian";
import type { App } from "obsidian";

export class DriveSyncSettingTab extends PluginSettingTab {
	plugin: PluginSettingsPanelPort;
	private remoteValidationSequence = 0;

	constructor(app: App, plugin: PluginSettingsPanelPort) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		const remoteState = this.plugin.getRemoteConnectionView();
		const remoteAuth = this.plugin.getRemoteAuthView();
		const hasAuthSession =
			remoteAuth.status === "signed_in" || remoteAuth.status === "pending_validation";

		const accountSetting = new Setting(containerEl)
			.setName(tr("settings.remoteAccount"))
			.setDesc("");
		accountSetting.settingEl.addClass("drive-sync-account-setting");
		const accountStatus = accountSetting.descEl.createDiv({
			cls: "drive-sync-account-status",
			text: this.getAuthStatusText(remoteAuth),
		});
		const authPaused = remoteAuth.status === "paused";
		if (hasAuthSession) {
			const providerChip = accountSetting.nameEl.createSpan({
				cls: "drive-sync-account-chip drive-sync-account-provider",
			});
			renderProviderIcon(providerChip, remoteState.providerId, remoteState.providerLabel);
			providerChip.createSpan({
				cls: "drive-sync-account-provider-label",
				text: remoteState.providerLabel,
			});
			const accountEmail = remoteState.accountEmail;
			if (accountEmail) {
				const accountChip = accountSetting.nameEl.createSpan({
					cls: "drive-sync-account-chip drive-sync-account-user",
					attr: {
						title: accountEmail,
					},
				});
				accountChip.createSpan({
					cls: "drive-sync-account-user-label",
					text: tr("settings.accountChipLabel"),
				});
				accountChip.createSpan({
					cls: "drive-sync-account-user-value",
					text: accountEmail,
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
					await this.plugin.logoutRemote();
					this.display();
				});
			});
		} else {
			accountSetting.settingEl.addClass("drive-sync-setting-callout");
			this.renderProviderLoginOptions(accountSetting.controlEl);
		}

		const remoteFolderPath = remoteState.scopePath;
		const remoteScopeId = remoteState.scopeId;
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

	private getAuthStatusText(remoteAuth = this.plugin.getRemoteAuthView()): string {
		switch (remoteAuth.status) {
			case "pending_validation":
				return tr("settings.authStatus.pendingValidation");
			case "signed_in":
				return tr("settings.authStatus.signedIn");
			case "paused":
				return remoteAuth.message ?? tr("settings.authStatus.needsAttentionCommand");
			case "needs_attention":
				return tr("settings.authStatus.needsAttention");
			default:
				return tr("settings.authStatus.signInHint");
		}
	}

	private renderProviderLoginOptions(containerEl: HTMLElement): void {
		const providers = this.plugin.listRemoteProviderOptions();
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
		if (!this.plugin.getRemoteAuthView().canBrowseRemoteFolder) {
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
		const remoteState = this.plugin.getRemoteConnectionView();
		const remoteAuth = this.plugin.getRemoteAuthView();
		const scopeId = remoteState.scopeId;
		if (!scopeId) {
			return {
				ok: false,
				message: tr("settings.validation.selectFolderFirst"),
			};
		}
		if (!remoteAuth.canBrowseRemoteFolder) {
			return {
				ok: false,
				message: tr("error.auth.signInFirst"),
			};
		}

		try {
			return await this.plugin.validateRemoteScope(scopeId);
		} catch (error) {
			const prepared = prepareDriveSyncErrorNotice(error, {
				category: "provider",
				userMessage: tr("error.provider.unableToConnect"),
				userMessageKey: "error.provider.unableToConnect",
			});
			return {
				ok: false,
				message: prepared.message,
			};
		}
	}
}
