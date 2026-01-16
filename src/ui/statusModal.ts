import { App, Modal } from "obsidian";
import { loadPluginData } from "../data/pluginData";

export class ProtonDriveStatusModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Proton Drive sync status" });

		const data = loadPluginData(this.app);
		const state = data.syncState;

		const rows: Array<[string, string]> = [
			[
				"Last sync",
				state.lastSyncAt
					? new Date(state.lastSyncAt).toLocaleString()
					: "Never",
			],
			["Last error", state.lastError ?? "None"],
			["Jobs queued", String(state.jobs?.length ?? 0)],
			[
				"Entries tracked",
				String(Object.keys(state.entries ?? {}).length),
			],
		];

		const list = contentEl.createEl("dl");
		for (const [label, value] of rows) {
			list.createEl("dt", { text: label });
			list.createEl("dd", { text: value });
		}
	}
}
