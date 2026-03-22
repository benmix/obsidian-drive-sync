import type { PluginConflictModalPort } from "@contracts/plugin/plugin-ui-port";
import { tr } from "@i18n";
import { Modal, Notice, Setting } from "obsidian";
import type { App } from "obsidian";

type ConflictItem = {
	path: string;
	remoteRev?: string;
	localMtimeMs?: number;
};

export class SyncConflictModal extends Modal {
	private plugin: PluginConflictModalPort;
	private conflicts: ConflictItem[] = [];
	private loading = false;
	private error: string | null = null;

	constructor(app: App, plugin: PluginConflictModalPort) {
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
		contentEl.createEl("h2", { text: tr("conflicts.title") });

		if (this.loading) {
			contentEl.createEl("p", {
				text: tr("conflicts.loading"),
			});
			return;
		}

		if (this.error) {
			contentEl.createEl("p", { text: this.error });
			return;
		}

		if (this.conflicts.length === 0) {
			contentEl.createEl("p", { text: tr("conflicts.none") });
			this.renderAutoSyncControls();
			return;
		}

		contentEl.createEl("p", {
			text: tr("conflicts.desc"),
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
					? tr("conflicts.localModified", {
							time: new Date(item.localMtimeMs).toLocaleString(),
						})
					: tr("conflicts.localModifiedUnknown"),
			});
			detail.createEl("div", {
				text: item.remoteRev
					? tr("conflicts.remoteRevision", {
							rev: item.remoteRev,
						})
					: tr("conflicts.remoteRevisionUnknown"),
			});

			const actions = new Setting(section);
			actions.addButton((button) => {
				button.setButtonText(tr("conflicts.clearMarker"));
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
		const control = new Setting(contentEl).setName(tr("conflicts.autoSync"));
		control.setDesc(
			this.plugin.isAutoSyncPaused()
				? tr("conflicts.autoSyncPaused")
				: tr("conflicts.autoSyncRunning"),
		);
		control.addButton((button) => {
			if (this.plugin.isAutoSyncPaused()) {
				button.setButtonText(tr("conflicts.resumeAutoSync"));
				button.setCta();
				button.onClick(() => {
					this.plugin.resumeAutoSync();
					new Notice(tr("notice.autoSyncResumed"));
					this.render();
				});
			} else {
				button.setButtonText(tr("conflicts.pauseAutoSync"));
				button.onClick(() => {
					this.plugin.pauseAutoSync();
					new Notice(tr("notice.autoSyncPaused"));
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
			new Notice(tr("conflicts.cleared"));
		}
		await this.loadConflicts();
		this.render();
	}
}
