import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";
import type { ObsidianDriveSyncPluginApi } from "../plugin/contracts";

type ConflictItem = {
	path: string;
	remoteRev?: string;
	localMtimeMs?: number;
};

export class SyncConflictModal extends Modal {
	private plugin: ObsidianDriveSyncPluginApi;
	private conflicts: ConflictItem[] = [];
	private loading = false;
	private error: string | null = null;

	constructor(app: App, plugin: ObsidianDriveSyncPluginApi) {
		super(app);
		this.plugin = plugin;
	}

	async onOpen() {
		await this.loadConflicts();
		this.render();
	}

	private async loadConflicts(): Promise<void> {
		this.loading = true;
		this.error = null;
		this.conflicts = [];
		const state = await this.plugin.loadSyncState();
		this.conflicts = Object.values(state.entries ?? {})
			.filter((entry) => entry.conflict)
			.map((entry) => ({
				path: entry.relPath,
				remoteRev: entry.remoteRev ?? entry.conflict?.remoteRev,
				localMtimeMs: entry.localMtimeMs ?? entry.conflict?.localMtimeMs,
			}));
		this.loading = false;
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Resolve sync conflicts" });

		if (this.loading) {
			contentEl.createEl("p", { text: "Loading conflicts..." });
			return;
		}

		if (this.error) {
			contentEl.createEl("p", { text: this.error });
			return;
		}

		if (this.conflicts.length === 0) {
			contentEl.createEl("p", { text: "No conflicts to resolve." });
			this.renderAutoSyncControls();
			return;
		}

		contentEl.createEl("p", {
			text: "Conflicts are resolved via conflict copies. Merge manually, then clear marker.",
		});

		for (const item of this.conflicts) {
			const section = contentEl.createDiv({
				cls: "drive-sync-conflict-row",
			});
			section.createEl("div", {
				text: item.path,
				cls: "drive-sync-conflict-path",
			});
			const detail = section.createEl("div", {
				cls: "drive-sync-conflict-meta",
			});
			detail.createEl("div", {
				text: item.localMtimeMs
					? `Local modified: ${new Date(item.localMtimeMs).toLocaleString()}`
					: "Local modified: unknown",
			});
			detail.createEl("div", {
				text: item.remoteRev
					? `Remote revision: ${item.remoteRev}`
					: "Remote revision: unknown",
			});

			const actions = new Setting(section);
			actions.addButton((button) => {
				button.setButtonText("Clear marker");
				button.onClick(async () => {
					await this.clearConflict(item.path, true);
				});
			});
		}

		this.renderAutoSyncControls();
	}

	private renderAutoSyncControls(): void {
		if (!this.plugin.settings.autoSyncEnabled) {
			return;
		}
		const { contentEl } = this;
		const control = new Setting(contentEl).setName("Auto sync");
		control.setDesc(
			this.plugin.isAutoSyncPaused()
				? "Auto sync is paused while conflicts are resolved."
				: "Auto sync is running.",
		);
		control.addButton((button) => {
			if (this.plugin.isAutoSyncPaused()) {
				button.setButtonText("Resume auto sync");
				button.setCta();
				button.onClick(() => {
					this.plugin.resumeAutoSync();
					new Notice("Auto sync resumed.");
					this.render();
				});
			} else {
				button.setButtonText("Pause auto sync");
				button.onClick(() => {
					this.plugin.pauseAutoSync();
					new Notice("Auto sync paused.");
					this.render();
				});
			}
		});
	}

	private async clearConflict(path: string, announce = true): Promise<void> {
		const cleared = await this.plugin.clearConflictMarker(path);
		if (!cleared) {
			return;
		}
		if (announce) {
			new Notice("Conflict cleared.");
		}
		await this.loadConflicts();
		this.render();
	}
}
