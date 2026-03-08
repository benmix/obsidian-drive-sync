import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";

import type { PreSyncEstimate } from "../contracts/ui/pre-sync";

import { formatBytes } from "./format";

export class SyncPreflightModal extends Modal {
	private estimate: PreSyncEstimate;
	private onConfirm: () => Promise<void>;
	private running = false;

	constructor(app: App, estimate: PreSyncEstimate, onConfirm: () => Promise<void>) {
		super(app);
		this.estimate = estimate;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Pre-sync check" });

		const list = contentEl.createEl("dl");
		list.createEl("dt", { text: "Jobs planned" });
		list.createEl("dd", { text: String(this.estimate.jobsPlanned) });
		list.createEl("dt", { text: "Entries evaluated" });
		list.createEl("dd", { text: String(this.estimate.entries) });
		list.createEl("dt", { text: "Upload size" });
		list.createEl("dd", { text: formatBytes(this.estimate.uploadBytes) });
		list.createEl("dt", { text: "Download size" });
		list.createEl("dd", { text: formatBytes(this.estimate.downloadBytes) });

		const controls = new Setting(contentEl);
		controls.addButton((button) => {
			button.setButtonText("Run sync");
			button.setCta();
			button.onClick(() => {
				void this.handleConfirm();
			});
		});
		controls.addButton((button) => {
			button.setButtonText("Cancel");
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
			console.warn("Pre-sync confirmation failed.", error);
			new Notice("Sync failed. Check the console for details.");
			this.running = false;
		}
	}
}
