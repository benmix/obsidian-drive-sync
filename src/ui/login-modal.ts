import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";
import type { ObsidianDriveSyncPluginApi } from "../contracts/plugin/plugin-api";

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
			text: `Sign in to ${remoteProvider.label}`,
		});

		let username = this.plugin.getRemoteAccountEmail();
		let password = "";
		let twoFactorCode = "";
		let mailboxPassword = "";

		new Setting(contentEl).setName("Email").addText((text) =>
			text
				.setPlaceholder("name@example.com")
				.setValue(username)
				.onChange((value) => {
					username = value;
				}),
		);

		new Setting(contentEl).setName("Password").addText((text) => {
			text.inputEl.type = "password";
			text.setPlaceholder("Enter your password");
			text.setValue(password);
			text.onChange((value) => {
				password = value;
			});
		});

		new Setting(contentEl)
			.setName("Two-factor code")
			.setDesc("Leave empty if two-factor authentication is not enabled.")
			.addText((text) =>
				text
					.setPlaceholder("123456")
					.setValue(twoFactorCode)
					.onChange((value) => {
						twoFactorCode = value;
					}),
			);

		new Setting(contentEl)
			.setName("Mailbox password")
			.setDesc("Only required if your provider uses a secondary mailbox password.")
			.addText((text) => {
				text.inputEl.type = "password";
				text.setPlaceholder("Enter mailbox password");
				text.setValue(mailboxPassword);
				text.onChange((value) => {
					mailboxPassword = value;
				});
			});

		const actionRow = new Setting(contentEl);
		actionRow.addButton((button) => {
			button.setButtonText("Sign in");
			button.setCta();
			button.onClick(async () => {
				if (!username.trim() || !password.trim()) {
					new Notice("Enter your account email and password.");
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

					this.plugin.setStoredProviderCredentials(result.credentials);
					this.plugin.setRemoteAccountEmail(result.userEmail ?? username.trim());
					this.plugin.setRemoteAuthSession(true);
					await this.plugin.saveSettings();
					this.plugin.handleAuthRecovered();

					new Notice(`Signed in to ${provider.label}.`);
					this.close();
				} catch (error) {
					const message = error instanceof Error ? error.message : "Unable to sign in.";
					this.plugin.setRemoteAuthSession(false);
					new Notice(message);
				}
			});
		});

		actionRow.addButton((button) => {
			button.setButtonText("Cancel");
			button.onClick(() => this.close());
		});
	}
}
