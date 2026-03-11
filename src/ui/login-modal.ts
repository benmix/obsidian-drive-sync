import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";

import type { ObsidianDriveSyncPluginApi } from "../contracts/plugin/plugin-api";
import { normalizeUnknownDriveSyncError, translateDriveSyncErrorUserMessage } from "../errors";
import { tr, trAny } from "../i18n";

export class RemoteProviderLoginModal extends Modal {
	private plugin: ObsidianDriveSyncPluginApi;
	private username = "";
	private password = "";
	private mailboxPassword = "";
	private twoFactorDigits = Array.from({ length: 6 }, () => "");
	private requiresTwoFactor = false;
	private requiresMailboxPassword = false;
	private isSubmitting = false;
	private flashTwoFactorErrorOnRender = false;
	private twoFactorInputEls: HTMLInputElement[] = [];

	constructor(app: App, plugin: ObsidianDriveSyncPluginApi) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		this.username = this.plugin.getRemoteAccountEmail();
		this.password = "";
		this.mailboxPassword = "";
		this.requiresTwoFactor = false;
		this.requiresMailboxPassword = false;
		this.isSubmitting = false;
		this.flashTwoFactorErrorOnRender = false;
		this.resetTwoFactorDigits();
		this.render();
	}

	onClose() {
		this.twoFactorInputEls = [];
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("drive-sync-login-modal");
		const remoteProvider = this.plugin.getRemoteProvider();

		contentEl.createEl("h2", {
			text: tr("login.title", {
				provider: remoteProvider.label,
			}),
		});

		new Setting(contentEl).setName(tr("login.email")).addText((text) =>
			text
				.setPlaceholder(tr("login.emailPlaceholder"))
				.setValue(this.username)
				.setDisabled(this.isSubmitting)
				.onChange((value) => {
					this.username = value;
				}),
		);

		new Setting(contentEl).setName(tr("login.password")).addText((text) => {
			text.inputEl.type = "password";
			text.setPlaceholder(tr("login.passwordPlaceholder"));
			text.setValue(this.password);
			text.setDisabled(this.isSubmitting);
			text.onChange((value) => {
				this.password = value;
			});
		});

		if (this.requiresMailboxPassword) {
			new Setting(contentEl)
				.setName(tr("login.mailboxPassword"))
				.setDesc(tr("login.mailboxPasswordDesc"))
				.addText((text) => {
					text.inputEl.type = "password";
					text.setPlaceholder(tr("login.mailboxPasswordPlaceholder"));
					text.setValue(this.mailboxPassword);
					text.setDisabled(this.isSubmitting);
					text.onChange((value) => {
						this.mailboxPassword = value;
					});
				});
		}

		this.twoFactorInputEls = [];
		if (this.requiresTwoFactor) {
			const tokenSection = contentEl.createDiv({
				cls: "drive-sync-login-token-section",
			});
			tokenSection.createDiv({
				cls: "drive-sync-login-token-label",
				text: tr("login.twoFactorCode"),
			});
			tokenSection.createDiv({
				cls: "drive-sync-login-token-desc",
				text: tr("login.twoFactorPrompt"),
			});

			const tokenGroup = tokenSection.createDiv({
				cls: "drive-sync-login-token-group",
			});

			for (let index = 0; index < 6; index += 1) {
				const input = tokenGroup.createEl("input", {
					type: "text",
					cls: "drive-sync-login-token-input",
				});
				input.inputMode = "numeric";
				input.autocomplete = "one-time-code";
				input.maxLength = 1;
				input.value = this.twoFactorDigits[index] ?? "";
				input.disabled = this.isSubmitting;
				input.setAttribute("aria-label", `${tr("login.twoFactorCode")} ${index + 1}`);
				this.twoFactorInputEls.push(input);

				input.addEventListener("keydown", (event) => {
					if (event.key === "Backspace" && !input.value && index > 0) {
						this.twoFactorDigits[index - 1] = "";
						const prev = this.twoFactorInputEls[index - 1];
						if (!prev) {
							return;
						}
						prev.value = "";
						prev.focus();
						prev.select();
						event.preventDefault();
						return;
					}
					if (event.key === "ArrowLeft" && index > 0) {
						this.twoFactorInputEls[index - 1]?.focus();
						event.preventDefault();
						return;
					}
					if (event.key === "ArrowRight" && index < 5) {
						this.twoFactorInputEls[index + 1]?.focus();
						event.preventDefault();
						return;
					}
					if (event.key.length === 1 && !/^\d$/.test(event.key)) {
						event.preventDefault();
					}
				});

				input.addEventListener("input", () => {
					const digit = input.value.replace(/\D/g, "").slice(-1);
					this.twoFactorDigits[index] = digit;
					input.value = digit;
					if (digit && index < 5) {
						this.twoFactorInputEls[index + 1]?.focus();
					}
					if (this.twoFactorDigits.every((item) => item.length === 1)) {
						void this.submitLogin(true);
					}
				});

				input.addEventListener("paste", (event) => {
					const pasted = event.clipboardData?.getData("text") ?? "";
					const digits = pasted.replace(/\D/g, "");
					if (!digits) {
						return;
					}
					event.preventDefault();
					let lastFilled = index;
					for (
						let cursor = index;
						cursor < 6 && cursor - index < digits.length;
						cursor += 1
					) {
						const next = digits[cursor - index];
						if (!next) {
							break;
						}
						this.twoFactorDigits[cursor] = next;
						const slot = this.twoFactorInputEls[cursor];
						if (slot) {
							slot.value = next;
						}
						lastFilled = cursor;
					}
					if (this.twoFactorDigits.every((item) => item.length === 1)) {
						void this.submitLogin(true);
						return;
					}
					const nextIndex = Math.min(lastFilled + 1, 5);
					this.twoFactorInputEls[nextIndex]?.focus();
				});

				input.addEventListener("focus", () => input.select());
			}

			if (this.flashTwoFactorErrorOnRender) {
				tokenGroup.addClass("is-error");
				this.flashTwoFactorErrorOnRender = false;
			}
		}

		const actionRow = new Setting(contentEl);
		actionRow.addButton((button) => {
			button.setButtonText(tr("login.signIn"));
			button.setCta();
			button.setDisabled(this.isSubmitting);
			button.onClick(() => void this.submitLogin(false));
		});

		actionRow.addButton((button) => {
			button.setButtonText(tr("login.cancel"));
			button.setDisabled(this.isSubmitting);
			button.onClick(() => this.close());
		});

		if (this.requiresTwoFactor && !this.isSubmitting) {
			this.focusTwoFactorInput(this.firstEmptyTwoFactorIndex());
		}
	}

	private async submitLogin(autoFromToken: boolean): Promise<void> {
		if (this.isSubmitting) {
			return;
		}
		const normalizedUsername = this.username.trim();
		if (!normalizedUsername || !this.password.trim()) {
			new Notice(tr("login.missingCredentials"));
			return;
		}
		const twoFactorCode = this.twoFactorDigits.join("");
		if (this.requiresTwoFactor && !/^\d{6}$/.test(twoFactorCode)) {
			if (!autoFromToken) {
				this.flashTwoFactorErrorOnRender = true;
				this.render();
				this.focusTwoFactorInput(this.firstEmptyTwoFactorIndex());
				new Notice(tr("login.missingTwoFactorCode"));
			}
			return;
		}

		this.isSubmitting = true;
		this.render();
		try {
			const provider = this.plugin.getRemoteProvider();
			const result = await provider.login({
				username: normalizedUsername,
				password: this.password,
				twoFactorCode: this.requiresTwoFactor ? twoFactorCode : undefined,
				mailboxPassword: this.requiresMailboxPassword
					? this.mailboxPassword.trim() || undefined
					: undefined,
			});

			this.plugin.setStoredProviderCredentials(result.credentials);
			this.plugin.setRemoteAccountEmail(result.userEmail ?? normalizedUsername);
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
			const normalized = normalizeUnknownDriveSyncError(error, {
				category: "auth",
				userMessage: tr("login.unableToSignIn"),
				userMessageKey: "login.unableToSignIn",
			});
			this.plugin.setRemoteAuthSession(false);

			if (normalized.code === "AUTH_2FA_REQUIRED") {
				const shouldShakeTokenInputs = this.requiresTwoFactor;
				this.requiresTwoFactor = true;
				this.resetTwoFactorDigits();
				this.flashTwoFactorErrorOnRender = shouldShakeTokenInputs;
				this.isSubmitting = false;
				this.render();
				this.focusTwoFactorInput(0);
				new Notice(translateDriveSyncErrorUserMessage(normalized, trAny));
				return;
			}
			if (normalized.code === "AUTH_MAILBOX_PASSWORD_REQUIRED") {
				this.requiresMailboxPassword = true;
				this.isSubmitting = false;
				this.render();
				new Notice(translateDriveSyncErrorUserMessage(normalized, trAny));
				return;
			}
			if (this.requiresTwoFactor) {
				this.resetTwoFactorDigits();
				this.flashTwoFactorErrorOnRender = true;
			}
			this.isSubmitting = false;
			this.render();
			if (this.requiresTwoFactor) {
				this.focusTwoFactorInput(0);
			}
			new Notice(translateDriveSyncErrorUserMessage(normalized, trAny));
		}
	}

	private resetTwoFactorDigits(): void {
		this.twoFactorDigits = Array.from({ length: 6 }, () => "");
	}

	private firstEmptyTwoFactorIndex(): number {
		const next = this.twoFactorDigits.findIndex((value) => !value);
		return next >= 0 ? next : 0;
	}

	private focusTwoFactorInput(index: number): void {
		const input = this.twoFactorInputEls[index];
		if (!input) {
			return;
		}
		input.focus();
		input.select();
	}
}
