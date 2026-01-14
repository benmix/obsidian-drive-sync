import {App, Modal, Notice, Setting} from "obsidian";
import type ProtonDriveSyncPlugin from "../main";

export class ProtonDriveLoginModal extends Modal {
	private plugin: ProtonDriveSyncPlugin;

	constructor(app: App, plugin: ProtonDriveSyncPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();

		contentEl.createEl("h2", {text: "Sign in to Proton Drive"});

		let username = this.plugin.settings.accountEmail;
		let password = "";
		let twoFactorCode = "";

		new Setting(contentEl)
			.setName("Email")
			.addText(text => text
				.setPlaceholder("name@example.com")
				.setValue(username)
				.onChange(value => {
					username = value;
				}));

		new Setting(contentEl)
			.setName("Password")
			.addText(text => {
				text.inputEl.type = "password";
				text.setPlaceholder("Enter your password");
				text.setValue(password);
				text.onChange(value => {
					password = value;
				});
			});

		new Setting(contentEl)
			.setName("Two-factor code")
			.setDesc("Leave empty if two-factor authentication is not enabled.")
			.addText(text => text
				.setPlaceholder("123456")
				.setValue(twoFactorCode)
				.onChange(value => {
					twoFactorCode = value;
				}));

		const actionRow = new Setting(contentEl);
		actionRow.addButton(button => {
			button.setButtonText("Sign in");
			button.setCta();
			button.onClick(async () => {
				if (!username.trim() || !password.trim()) {
					new Notice("Enter your Proton account email and password.");
					return;
				}

				try {
					const session = await this.plugin.authService.login({
						username: username.trim(),
						password,
						twoFactorCode: twoFactorCode.trim() || undefined
					});

					this.plugin.settings.sessionToken = session.sessionToken;
					this.plugin.settings.accountEmail = session.userEmail ?? username.trim();
					await this.plugin.saveSettings();

					new Notice("Signed in to Proton Drive.");
					this.close();
				} catch (error) {
					const message = error instanceof Error ? error.message : "Unable to sign in.";
					new Notice(message);
				}
			});
		});

		actionRow.addButton(button => {
			button.setButtonText("Cancel");
			button.onClick(() => this.close());
		});
	}
}
