import { App, Modal, Setting } from "obsidian";
import type ProtonDriveSyncPlugin from "../main";
import { loadPluginData } from "../data/plugin-data";

export class ProtonDriveStatusModal extends Modal {
	private plugin: ProtonDriveSyncPlugin;

	constructor(app: App, plugin: ProtonDriveSyncPlugin) {
		super(app);
		this.plugin = plugin;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Proton Drive sync status" });

		const data = loadPluginData(this.app);
		const state = data.syncState;
		const autoSyncStatus = data.settings.autoSyncEnabled
			? this.plugin.isAutoSyncPaused()
				? "Paused"
				: "Running"
			: "Disabled";

		const rows: Array<[string, string]> = [
			["Last sync", state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString() : "Never"],
			["Auto sync", autoSyncStatus],
			["Last error", state.lastError ?? "None"],
			["Jobs queued", String(state.jobs?.length ?? 0)],
			["Entries tracked", String(Object.keys(state.entries ?? {}).length)],
		];

		const list = contentEl.createEl("dl");
		for (const [label, value] of rows) {
			list.createEl("dt", { text: label });
			list.createEl("dd", { text: value });
		}

		if (data.settings.autoSyncEnabled) {
			const control = new Setting(contentEl);
			control.addButton((button) => {
				button.setButtonText(
					this.plugin.isAutoSyncPaused() ? "Resume auto sync" : "Pause auto sync",
				);
				button.onClick(() => {
					if (this.plugin.isAutoSyncPaused()) {
						this.plugin.resumeAutoSync();
					} else {
						this.plugin.pauseAutoSync();
					}
					this.onOpen();
				});
			});
		}
	}
}
