import type { ObsidianDriveSyncPluginApi } from "@contracts/plugin/plugin-ui-port";
import { normalizeUnknownDriveSyncError, translateDriveSyncErrorUserMessage } from "@errors";
import { tr, trAny } from "@i18n";
import { shouldPreventTwoFactorKeydown } from "@ui/login-modal-helpers";
import { renderProviderIcon } from "@ui/provider-icon";
import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";

type RemoteProviderLoginModalOptions = {
	providerId?: string;
	onCancel?: () => void;
	onSuccess?: () => void;
};

export class RemoteProviderLoginModal extends Modal {
	private plugin: ObsidianDriveSyncPluginApi;
	private providerId: string;
	private onCancel?: () => void;
	private onSuccess?: () => void;
	private username = "";
	private password = "";
	private mailboxPassword = "";
	private twoFactorDigits = Array.from({ length: 6 }, () => "");
	private requiresTwoFactor = false;
	private requiresMailboxPassword = false;
	private isSubmitting = false;
	private flashTwoFactorErrorOnRender = false;
	private twoFactorInputEls: HTMLInputElement[] = [];
	private loginCompleted = false;

	constructor(
		app: App,
		plugin: ObsidianDriveSyncPluginApi,
		options: RemoteProviderLoginModalOptions = {},
	) {
		super(app);
		this.plugin = plugin;
		this.providerId = options.providerId ?? plugin.getRemoteConnectionView().providerId;
		this.onCancel = options.onCancel;
		this.onSuccess = options.onSuccess;
	}

	onOpen() {
		const remoteState = this.plugin.getRemoteConnectionView();
		this.username = this.providerId === remoteState.providerId ? remoteState.accountEmail : "";
		this.password = "";
		this.mailboxPassword = "";
		this.requiresTwoFactor = false;
		this.requiresMailboxPassword = false;
		this.isSubmitting = false;
		this.flashTwoFactorErrorOnRender = false;
		this.loginCompleted = false;
		this.resetTwoFactorDigits();
		this.render();
	}

	onClose() {
		this.twoFactorInputEls = [];
		this.contentEl.empty();
		if (!this.loginCompleted) {
			this.onCancel?.();
		}
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("drive-sync-login-modal");
		const remoteProvider = this.getTargetProvider();
		const loginUi = this.getLoginUi(remoteProvider.id);
		const shell = contentEl.createDiv({
			cls: "drive-sync-login-shell",
		});
		const hero = shell.createDiv({
			cls: "drive-sync-login-hero",
		});
		const providerRow = hero.createDiv({
			cls: "drive-sync-login-provider-row",
		});
		renderProviderIcon(
			providerRow,
			remoteProvider.id,
			remoteProvider.label,
			"drive-sync-provider-icon drive-sync-login-provider-icon",
		);
		providerRow.createDiv({
			cls: "drive-sync-login-provider-pill",
			text: remoteProvider.label,
		});
		hero.createEl("h2", {
			text: tr("login.title", {
				provider: remoteProvider.label,
			}),
		});
		hero.createDiv({
			cls: "drive-sync-login-subtitle",
			text: loginUi.subtitle,
		});
		const chips = hero.createDiv({
			cls: "drive-sync-login-chips",
		});
		if (this.requiresTwoFactor) {
			this.renderChip(chips, tr("login.verificationStep"), true);
		}
		if (this.requiresMailboxPassword) {
			this.renderChip(chips, tr("login.extraSecurityStep"), true);
		}

		const card = shell.createDiv({
			cls: "drive-sync-login-card",
		});
		if (this.requiresTwoFactor || this.requiresMailboxPassword) {
			card.createDiv({
				cls: "drive-sync-login-card-title",
				text: this.requiresTwoFactor
					? tr("login.verificationStep")
					: tr("login.extraSecurityStep"),
			});
		}

		const emailSetting = new Setting(card).setName(tr("login.email")).addText((text) =>
			text
				.setPlaceholder(tr("login.emailPlaceholder"))
				.setValue(this.username)
				.setDisabled(this.isSubmitting)
				.onChange((value) => {
					this.username = value;
				}),
		);
		emailSetting.settingEl.addClass("drive-sync-login-field");

		const passwordSetting = new Setting(card).setName(tr("login.password")).addText((text) => {
			text.inputEl.type = "password";
			text.setPlaceholder(tr("login.passwordPlaceholder"));
			text.setValue(this.password);
			text.setDisabled(this.isSubmitting);
			text.onChange((value) => {
				this.password = value;
			});
		});
		passwordSetting.settingEl.addClass("drive-sync-login-field");

		if (this.requiresMailboxPassword) {
			const mailboxSetting = new Setting(card)
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
			mailboxSetting.settingEl.addClass("drive-sync-login-field");
		}

		this.twoFactorInputEls = [];
		if (this.requiresTwoFactor) {
			const tokenSection = card.createDiv({
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
					if (shouldPreventTwoFactorKeydown(event)) {
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

		const actionRow = new Setting(card);
		actionRow.settingEl.addClass("drive-sync-login-actions");
		actionRow.addButton((button) => {
			button.setButtonText(this.isSubmitting ? tr("login.signingIn") : tr("login.signIn"));
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

	private renderChip(container: HTMLElement, label: string, active: boolean): void {
		container.createDiv({
			cls: `drive-sync-login-chip${active ? " is-active" : ""}`,
			text: label,
		});
	}

	private getLoginUi(providerId: string): {
		subtitle: string;
	} {
		switch (providerId) {
			case "proton-drive":
				return {
					subtitle: tr("login.subtitle"),
				};
			default:
				return {
					subtitle: tr("login.subtitle"),
				};
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
			const result = await this.plugin.loginRemote(this.providerId, {
				username: normalizedUsername,
				password: this.password,
				twoFactorCode: this.requiresTwoFactor ? twoFactorCode : undefined,
				mailboxPassword: this.requiresMailboxPassword
					? this.mailboxPassword.trim() || undefined
					: undefined,
			});

			new Notice(
				tr("login.signedInToProvider", {
					provider: result.providerLabel,
				}),
			);
			this.loginCompleted = true;
			this.close();
			this.onSuccess?.();
		} catch (error) {
			const normalized = normalizeUnknownDriveSyncError(error, {
				category: "auth",
				userMessage: tr("login.unableToSignIn"),
				userMessageKey: "login.unableToSignIn",
			});

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

	private getTargetProvider(): { id: string; label: string } {
		const provider = this.plugin
			.listRemoteProviderOptions()
			.find((item) => item.id === this.providerId);
		if (!provider) {
			throw new Error(`Remote provider not found: ${this.providerId}`);
		}
		return provider;
	}
}
