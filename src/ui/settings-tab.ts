import { PluginSettingTab, Setting } from "obsidian";
import type { App } from "obsidian";
import { siProtondrive } from "simple-icons";

import type { ObsidianDriveSyncPluginApi } from "../contracts/plugin/plugin-api";
import type { DriveSyncSettings } from "../contracts/plugin/settings";
import { tr } from "../i18n";

import { RemoteProviderLoginModal } from "./login-modal";
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
			.setName(hasAuthSession ? provider.label : tr("settings.remoteAccount"))
			.setDesc("");
		const authPaused = this.plugin.isAuthPaused();
		if (hasAuthSession) {
			accountSetting.nameEl.addClass("drive-sync-brand-name");
			this.renderProviderIcon(accountSetting.nameEl, provider.id, provider.label);
		}
		accountSetting.descEl.createDiv({
			cls: "drive-sync-account-status",
			text: this.getAuthStatusText(),
		});
		if (authPaused) {
			accountSetting.settingEl.addClass("drive-sync-setting-callout", "is-auth-warning");
			accountSetting.descEl.addClass("is-error");
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
			accountSetting.addButton((button) => {
				button.setClass("drive-sync-provider-icon-button");
				button.setTooltip(
					tr("settings.signInToProviderTooltip", {
						provider: provider.label,
					}),
				);
				this.renderProviderIcon(button.buttonEl, provider.id, provider.label);
				button.onClick(() => this.openLoginModal());
			});
		}

		const remoteFolderPath = this.plugin.getRemoteScopePath();
		const remoteFolderId = this.plugin.getRemoteScopeId();
		const remotePathLabel = remoteFolderPath
			? remoteFolderPath
			: remoteFolderId
				? tr("settings.remoteFolderPath.idConfigured")
				: tr("settings.remoteFolderPath.notSelected");
		const remoteFolderSetting = new Setting(containerEl)
			.setName(tr("settings.remoteFolder"))
			.setDesc(
				tr("settings.remoteFolderDesc", {
					provider: provider.label,
				}),
			)
			.addText((text) => text.setValue(remotePathLabel).setDisabled(true))
			.addButton((button) => {
				button.setButtonText(tr("settings.remoteFolderChoose"));
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
			const email = this.plugin.getRemoteAccountEmail();
			return email
				? tr("settings.authStatus.signedInAs", {
						email,
					})
				: tr("settings.authStatus.signedInToProvider", {
						provider: provider.label,
					});
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

	private openLoginModal(): void {
		const modal = new RemoteProviderLoginModal(this.app, this.plugin);
		modal.onClose = () => {
			this.display();
		};
		modal.open();
	}

	private renderProviderIcon(
		containerEl: HTMLElement,
		providerId: string,
		providerLabel: string,
	): void {
		const iconSvg = this.getProviderIconSvg(providerId);
		if (!iconSvg) {
			return;
		}
		const iconEl = containerEl.createSpan({
			cls: "drive-sync-provider-icon",
			attr: { "aria-label": providerLabel },
		});
		iconEl.innerHTML = iconSvg;
		containerEl.insertBefore(iconEl, containerEl.firstChild);
	}

	private getProviderIconSvg(providerId: string): string | null {
		if (providerId === "proton-drive") {
			return `<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
				<path fill="currentColor" d="${siProtondrive.path}"/>
			</svg>`;
		}
		return null;
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
				message: tr("notice.signInToProviderFirst", {
					provider: provider.label,
				}),
			};
		}

		const client = await this.plugin.connectRemoteClient();
		if (!client) {
			return {
				ok: false,
				message: tr("notice.unableToConnectProvider", {
					provider: provider.label,
				}),
			};
		}
		return await provider.validateScope(client, scopeId);
	}
}
