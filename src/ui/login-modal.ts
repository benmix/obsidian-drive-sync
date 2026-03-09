import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";

import type { ObsidianDriveSyncPluginApi } from "../contracts/plugin/plugin-api";
import { tr } from "../i18n";

export class RemoteProviderLoginModal extends Modal {
	private plugin: ObsidianDriveSyncPluginApi;

	constructor(app: App, plugin: ObsidianDriveSyncPluginApi) {
		super(app);
		this.plugin = plugin;
	}


	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		const remoteProvider = this.plugin.getRemoteProvider();

		contentEl.createEl("h2", {
			text: tr("login.title", {
				provider: remoteProvider.label,
			}),
		});

		let username = this.plugin.getRemoteAccountEmail();
		let password = "";
		let twoFactorCode = "";
		let mailboxPassword = "";

		new Setting(contentEl).setName(tr("login.email")).addText((text) =>
			text
				.setPlaceholder(tr("login.emailPlaceholder"))
				.setValue(username)
				.onChange((value) => {
					username = value;
				}),
		);

		new Setting(contentEl)
			.setName(tr("login.password"))
			.addText((text) => {
				text.inputEl.type = "password";
				text.setPlaceholder(tr("login.passwordPlaceholder"));
				text.setValue(password);
				text.onChange((value) => {
					password = value;
				});
			});

		new Setting(contentEl)
			.setName(tr("login.twoFactorCode"))
			.setDesc(tr("login.twoFactorDesc"))
			.addText((text) =>
				text
					.setPlaceholder(tr("login.twoFactorPlaceholder"))
					.setValue(twoFactorCode)
					.onChange((value) => {
						twoFactorCode = value;
					}),
			);

		new Setting(contentEl)
			.setName(tr("login.mailboxPassword"))
			.setDesc(tr("login.mailboxPasswordDesc"))
			.addText((text) => {
				text.inputEl.type = "password";
				text.setPlaceholder(
					tr("login.mailboxPasswordPlaceholder"),
				);
				text.setValue(mailboxPassword);
				text.onChange((value) => {
					mailboxPassword = value;
				});
			});

		const actionRow = new Setting(contentEl);
		actionRow.addButton((button) => {
			button.setButtonText(tr("login.signIn"));
			button.setCta();
			button.onClick(async () => {
				if (!username.trim() || !password.trim()) {
					new Notice(tr("login.missingCredentials"));
					return;
				}

				try {
					const provider = this.plugin.getRemoteProvider();
					const result = await provider.login({
						username: username.trim(),
						password,
						twoFactorCode: twoFactorCode.trim() || undefined,
						mailboxPassword: mailboxPassword.trim() || undefined,
					});

					this.plugin.setStoredProviderCredentials(
						result.credentials,
					);
					this.plugin.setRemoteAccountEmail(
						result.userEmail ?? username.trim(),
					);
					this.plugin.setRemoteAuthSession(true);
					await this.plugin.saveSettings();
					this.plugin.handleAuthRecovered();

					new Notice(
						tr("login.signedInToProvider", {
							provider: provider.label,
						}),
					);
					this.close();
				} catch (error) {
					const message =
						error instanceof Error
							? error.message
							: tr("login.unableToSignIn");
					this.plugin.setRemoteAuthSession(false);
					new Notice(message);
				}
			});
		});

		actionRow.addButton((button) => {
			button.setButtonText(tr("login.cancel"));
			button.onClick(() => this.close());
		});
	}
}
