import type { ObsidianDriveSyncPluginApi } from "@contracts/plugin/plugin-ui-port";
import { normalizeUnknownDriveSyncError, translateDriveSyncErrorUserMessage } from "@errors";
import { tr, trAny } from "@i18n";
import { RemoteProviderLoginModal } from "@ui/login-modal";
import { renderProviderIcon } from "@ui/provider-icon";
import { Modal, Notice } from "obsidian";
import type { App } from "obsidian";

type RemoteLoginFlowOptions = {
	onCancel?: () => void;
	onSuccess?: () => void;
};

type RemoteProviderPickerOptions = {
	title?: string;
	closeOnSelect?: boolean;
	onDismiss?: () => void;
	loginFlow?: RemoteLoginFlowOptions;
};

export class RemoteAuthRequiredModal extends Modal {
	private plugin: ObsidianDriveSyncPluginApi;

	constructor(app: App, plugin: ObsidianDriveSyncPluginApi, _message?: string) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass("drive-sync-auth-required-shell");
		contentEl.empty();
		contentEl.addClass("drive-sync-auth-required-modal");
		renderRemoteProviderPickerCard(contentEl, this.plugin, {
			title: tr("providerPicker.title"),
			onDismiss: () => {
				this.close();
			},
		});
	}
}

export class RemoteProviderPickerModal extends Modal {
	private plugin: ObsidianDriveSyncPluginApi;
	private loginFlow?: RemoteLoginFlowOptions;

	constructor(app: App, plugin: ObsidianDriveSyncPluginApi, loginFlow?: RemoteLoginFlowOptions) {
		super(app);
		this.plugin = plugin;
		this.loginFlow = loginFlow;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		modalEl.addClass("drive-sync-auth-required-shell");
		contentEl.empty();
		contentEl.addClass("drive-sync-auth-required-modal");
		renderRemoteProviderPickerCard(contentEl, this.plugin, {
			title: tr("providerPicker.title"),
			onDismiss: () => {
				this.close();
			},
			loginFlow: this.loginFlow,
		});
	}
}
export function openRemoteLoginModal(
	plugin: ObsidianDriveSyncPluginApi,
	loginFlow?: RemoteLoginFlowOptions,
): void {
	const modal = new RemoteProviderPickerModal(plugin.app, plugin, loginFlow);
	modal.open();
}

export async function openProviderLoginModal(
	plugin: ObsidianDriveSyncPluginApi,
	providerId: string,
	loginFlow?: RemoteLoginFlowOptions,
): Promise<void> {
	try {
		openSelectedProviderLoginModal(plugin, providerId, loginFlow);
	} catch (error) {
		const normalized = normalizeUnknownDriveSyncError(error, {
			category: "config",
			userMessage: tr("error.config.providerMissing"),
			userMessageKey: "error.config.providerMissing",
		});
		new Notice(translateDriveSyncErrorUserMessage(normalized, trAny));
	}
}

export function renderRemoteProviderPickerCard(
	containerEl: HTMLElement,
	plugin: ObsidianDriveSyncPluginApi,
	options: RemoteProviderPickerOptions = {},
): void {
	const prompt = containerEl.createDiv({
		cls: "drive-sync-auth-prompt",
	});

	const providerGrid = prompt.createDiv({
		cls: "drive-sync-provider-picker-grid",
	});
	const providers = plugin.listRemoteProviderOptions();
	const remoteState = plugin.getRemoteConnectionView();
	for (const provider of providers) {
		const providerButton = providerGrid.createEl("button", {
			cls: "drive-sync-provider-picker-option",
		});
		if (provider.id === remoteState.providerId) {
			providerButton.addClass("is-active");
		}
		const iconWrap = providerButton.createDiv({
			cls: "drive-sync-provider-picker-icon-wrap",
		});
		renderProviderIcon(
			iconWrap,
			provider.id,
			provider.label,
			"drive-sync-provider-icon drive-sync-provider-picker-icon",
		);
		providerButton.setAttribute("aria-label", provider.label);
		providerButton.setAttribute("title", provider.label);
		providerButton.addEventListener("click", () => {
			void selectProviderAndOpenLogin(plugin, provider.id, options);
		});
	}
}

async function selectProviderAndOpenLogin(
	plugin: ObsidianDriveSyncPluginApi,
	providerId: string,
	options: RemoteProviderPickerOptions,
): Promise<void> {
	try {
		if (options.closeOnSelect !== false) {
			options.onDismiss?.();
		}
		openSelectedProviderLoginModal(plugin, providerId, {
			onSuccess: options.loginFlow?.onSuccess,
			onCancel: () => {
				if (options.closeOnSelect !== false) {
					openRemoteLoginModal(plugin, options.loginFlow);
					return;
				}
				options.loginFlow?.onCancel?.();
			},
		});
	} catch (error) {
		const normalized = normalizeUnknownDriveSyncError(error, {
			category: "config",
			userMessage: tr("error.config.providerMissing"),
			userMessageKey: "error.config.providerMissing",
		});
		new Notice(translateDriveSyncErrorUserMessage(normalized, trAny));
	}
}

function openSelectedProviderLoginModal(
	plugin: ObsidianDriveSyncPluginApi,
	providerId: string,
	loginFlow?: RemoteLoginFlowOptions,
): void {
	const modal = new RemoteProviderLoginModal(plugin.app, plugin, {
		providerId,
		onCancel: loginFlow?.onCancel,
		onSuccess: loginFlow?.onSuccess,
	});
	modal.open();
}
