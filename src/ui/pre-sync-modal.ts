import type { PluginPreSyncModalPort } from "@contracts/plugin/plugin-ui-port";
import type { PreSyncEstimate } from "@contracts/ui/pre-sync";
import { normalizeUnknownDriveSyncError, translateDriveSyncErrorUserMessage } from "@errors";
import { tr, trAny } from "@i18n";
import { formatBytes } from "@ui/format";
import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";

export class SyncPreflightModal extends Modal {
	private plugin: PluginPreSyncModalPort;
	private estimate: PreSyncEstimate;
	private onConfirm: () => Promise<void>;
	private running = false;

	constructor(
		app: App,
		plugin: PluginPreSyncModalPort,
		estimate: PreSyncEstimate,
		onConfirm: () => Promise<void>,
	) {
		super(app);
		this.plugin = plugin;
		this.estimate = estimate;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: tr("preSync.title") });

		const list = contentEl.createEl("dl");
		list.createEl("dt", { text: tr("preSync.jobsPlanned") });
		list.createEl("dd", { text: String(this.estimate.jobsPlanned) });
		list.createEl("dt", {
			text: tr("preSync.entriesEvaluated"),
		});
		list.createEl("dd", { text: String(this.estimate.entries) });
		list.createEl("dt", { text: tr("preSync.uploadSize") });
		list.createEl("dd", { text: formatBytes(this.estimate.uploadBytes) });
		list.createEl("dt", { text: tr("preSync.downloadSize") });
		list.createEl("dd", { text: formatBytes(this.estimate.downloadBytes) });

		const controls = new Setting(contentEl);
		controls.addButton((button) => {
			button.setButtonText(tr("preSync.runSync"));
			button.setCta();
			button.onClick(() => {
				void this.handleConfirm();
			});
		});
		controls.addButton((button) => {
			button.setButtonText(tr("preSync.cancel"));
			button.onClick(() => {
				this.close();
			});
		});
	}

	private async handleConfirm(): Promise<void> {
		if (this.running) {
			return;
		}
		this.running = true;
		try {
			await this.onConfirm();
			this.close();
		} catch (error) {
			const normalized = normalizeUnknownDriveSyncError(error, {
				category: "sync",
				userMessage: tr("preSync.confirmFailed"),
				userMessageKey: "preSync.confirmFailed",
			});
			console.warn("Pre-sync confirmation failed.", error);
			new Notice(translateDriveSyncErrorUserMessage(normalized, trAny));
			this.running = false;
		}
	}
}
