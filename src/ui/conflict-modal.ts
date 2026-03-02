import type { App } from "obsidian";
import { Modal, Notice, Setting } from "obsidian";
import type ProtonDriveSyncPlugin from "../main";
import { loadPluginData } from "../data/plugin-data";
import { PluginDataStateStore } from "../sync/state-store";
import { ObsidianLocalFs } from "../sync/local-fs";
import { ProtonDriveRemoteFs } from "../sync/remote-fs";
import { SyncEngine } from "../sync/sync-engine";
import { now } from "../sync/utils";
import type { ProtonSession } from "../proton-drive/sdk-session";

type ConflictItem = {
	path: string;
	remoteId?: string;
	remoteRev?: string;
	localMtimeMs?: number;
};

export class ProtonDriveConflictModal extends Modal {
	private plugin: ProtonDriveSyncPlugin;
	private conflicts: ConflictItem[] = [];
	private loading = false;
	private error: string | null = null;

	constructor(app: App, plugin: ProtonDriveSyncPlugin) {
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
		const state = await new PluginDataStateStore().load();
		this.conflicts = Object.values(state.entries ?? {})
			.filter((entry) => entry.conflict)
			.map((entry) => ({
				path: entry.relPath,
				remoteId: entry.remoteId ?? entry.conflict?.remoteId,
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

		for (const item of this.conflicts) {
			const section = contentEl.createDiv({
				cls: "protondrive-conflict-row",
			});
			section.createEl("div", {
				text: item.path,
				cls: "protondrive-conflict-path",
			});
			const detail = section.createEl("div", {
				cls: "protondrive-conflict-meta",
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
				button.setButtonText("Keep local");
				button.onClick(async () => {
					await this.resolveConflict(item, "local");
				});
			});
			actions.addButton((button) => {
				button.setButtonText("Use remote");
				button.onClick(async () => {
					await this.resolveConflict(item, "remote");
				});
			});
			actions.addButton((button) => {
				button.setButtonText("Clear");
				button.onClick(async () => {
					await this.resolveConflict(item, "skip");
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

	private async resolveConflict(
		item: ConflictItem,
		strategy: "local" | "remote" | "skip",
	): Promise<void> {
		try {
			if (strategy === "skip") {
				await this.clearConflict(item.path, false);
				return;
			}
			const data = await loadPluginData(this.plugin);
			if (!data.settings.remoteFolderId.trim()) {
				new Notice("Select a remote folder in settings first.");
				return;
			}
			if (!data.settings.protonSession || !data.settings.hasAuthSession) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}

			const session = this.plugin.authService.getSession();
			if (!session) {
				new Notice("Sign in to Proton Drive first.");
				return;
			}
			const activeSession: ProtonSession = { ...session };
			activeSession.onTokenRefresh = async () => {
				try {
					await this.plugin.authService.refreshToken();
					const refreshedSession = this.plugin.authService.getSession();
					if (refreshedSession) {
						Object.assign(activeSession, refreshedSession);
					}
					this.plugin.settings.protonSession =
						this.plugin.authService.getReusableCredentials();
					this.plugin.settings.hasAuthSession = true;
					await this.plugin.saveSettings();
				} catch (refreshError) {
					console.warn("Failed to refresh Proton session.", refreshError);
					this.plugin.settings.hasAuthSession = false;
					await this.plugin.saveSettings();
				}
			};
			const client = await this.plugin.protonDriveService.connect(activeSession);
			if (!client) {
				new Notice("Unable to connect to Proton Drive.");
				return;
			}

			const localFs = new ObsidianLocalFs(this.app);
			const remoteFs = new ProtonDriveRemoteFs(client, data.settings.remoteFolderId);
			const stateStore = new PluginDataStateStore();
			const engine = new SyncEngine(localFs, remoteFs, stateStore, {
				conflictStrategy: data.settings.conflictStrategy,
			});
			await engine.load();

			if (strategy === "local") {
				engine.enqueue({
					id: `upload:${item.path}:${now()}`,
					op: "upload",
					path: item.path,
					entryType: "file",
					priority: 5,
					attempt: 0,
					nextRunAt: now(),
					reason: "conflict-local",
				});
			} else if (item.remoteId) {
				engine.enqueue({
					id: `download:${item.remoteId}:resolve`,
					op: "download",
					path: item.path,
					remoteId: item.remoteId,
					remoteRev: item.remoteRev,
					entryType: "file",
					priority: 5,
					attempt: 0,
					nextRunAt: now(),
					reason: "conflict-remote",
				});
			} else {
				new Notice("Remote file is missing for this conflict.");
				return;
			}

			await engine.runOnce();
			await this.clearConflict(item.path, false);
			if (this.plugin.settings.autoSyncEnabled && this.plugin.isAutoSyncPaused()) {
				this.plugin.resumeAutoSync();
				new Notice("Auto sync resumed.");
			}
			new Notice("Conflict resolved.");
			await this.loadConflicts();
			this.render();
		} catch (resolveError) {
			console.warn("Failed to resolve conflict.", resolveError);
			new Notice("Failed to resolve conflict.");
		}
	}

	private async clearConflict(path: string, announce = true): Promise<void> {
		const stateStore = new PluginDataStateStore();
		const state = await stateStore.load();
		const entry = state.entries[path];
		if (!entry) {
			return;
		}
		entry.conflict = undefined;
		state.entries[path] = entry;
		await stateStore.save(state);
		if (announce) {
			new Notice("Conflict cleared.");
		}
		await this.loadConflicts();
		this.render();
	}
}
