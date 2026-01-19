import type { App } from "obsidian";
import { Modal, Setting } from "obsidian";
import type ProtonDriveSyncPlugin from "../main";
import { loadPluginData } from "../data/plugin-data";
import { PluginDataStateStore } from "../sync/state-store";

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

		const data = await loadPluginData(this.plugin);
		const state = await new PluginDataStateStore().load();
		const conflicts = Object.values(state.entries ?? {}).filter((entry) => entry.conflict);
		const logs = state.logs ?? [];
		const autoSyncStatus = data.settings.autoSyncEnabled
			? this.plugin.isAutoSyncPaused()
				? "Paused"
				: "Running"
			: "Disabled";
		const authStatus = this.plugin.isAuthPaused()
			? (this.plugin.getLastAuthError() ?? "Auth paused")
			: this.plugin.authService.isSessionValidated()
				? "OK"
				: "Session stored (validation pending)";

		const jobCounts = {
			pending: 0,
			processing: 0,
			blocked: 0,
		};
		for (const job of state.jobs ?? []) {
			if (job.status === "processing") {
				jobCounts.processing += 1;
			} else if (job.status === "blocked") {
				jobCounts.blocked += 1;
			} else {
				jobCounts.pending += 1;
			}
		}

		const rows: Array<[string, string]> = [
			["Last sync", state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString() : "Never"],
			["Auto sync", autoSyncStatus],
			["Auth status", authStatus],
			["Last error", state.lastError ?? "None"],
			["Jobs queued", String(state.jobs?.length ?? 0)],
			[
				"Jobs by state",
				`pending ${jobCounts.pending}, processing ${jobCounts.processing}, blocked ${jobCounts.blocked}`,
			],
			["Entries tracked", String(Object.keys(state.entries ?? {}).length)],
			["Conflicts", String(conflicts.length)],
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

		if (conflicts.length > 0) {
			contentEl.createEl("h3", { text: "Conflicts needing review" });
			const list = contentEl.createEl("ul");
			for (const conflict of conflicts.slice(0, 10)) {
				list.createEl("li", { text: conflict.relPath });
			}
			if (conflicts.length > 10) {
				contentEl.createEl("p", {
					text: `And ${conflicts.length - 10} more...`,
				});
			}
		}

		if (logs.length > 0) {
			contentEl.createEl("h3", { text: "Recent logs" });
			const logList = contentEl.createEl("div", {
				cls: "protondrive-sync-logs",
			});
			for (const entry of logs.slice(-20)) {
				const row = logList.createEl("div", {
					cls: "protondrive-sync-log-row",
				});
				row.createEl("div", { text: entry.at });
				row.createEl("div", { text: entry.context ?? "general" });
				row.createEl("div", { text: entry.message });
			}
		}
	}
}
