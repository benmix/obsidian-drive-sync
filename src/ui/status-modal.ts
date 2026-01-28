import type { App } from "obsidian";
import { Modal, Setting } from "obsidian";
import type ProtonDriveSyncPlugin from "../main";
import { loadPluginData } from "../data/plugin-data";
import { PluginDataStateStore } from "../sync/state-store";
import { formatBytes, now } from "../sync/utils";

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
		const nowTs = now();
		let nextRetryAt: number | null = null;
		let nextRetryCount = 0;
		let inFlightJob: string | null = null;
		for (const job of state.jobs ?? []) {
			if (job.status === "processing") {
				jobCounts.processing += 1;
				if (!inFlightJob) {
					inFlightJob = `${job.op} · ${job.path}`;
				}
			} else if (job.status === "blocked") {
				jobCounts.blocked += 1;
			} else {
				jobCounts.pending += 1;
			}
			if (job.nextRunAt && job.nextRunAt > nowTs) {
				nextRetryCount += 1;
				if (!nextRetryAt || job.nextRunAt < nextRetryAt) {
					nextRetryAt = job.nextRunAt;
				}
			}
		}

		const rows: Array<[string, string]> = [
			["Last sync", state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString() : "Never"],
			["Sync activity", this.plugin.isSyncRunning() ? "In progress" : "Idle"],
			["Auto sync", autoSyncStatus],
			["Auth status", authStatus],
			["Last error", state.lastError ?? "None"],
			["Jobs queued", String(state.jobs?.length ?? 0)],
			[
				"Jobs by state",
				`pending ${jobCounts.pending}, processing ${jobCounts.processing}, blocked ${jobCounts.blocked}`,
			],
			["In-flight job", inFlightJob ?? "None"],
			[
				"Next retry",
				nextRetryAt
					? `${new Date(nextRetryAt).toLocaleString()} (${nextRetryCount})`
					: "None",
			],
			["Entries tracked", String(Object.keys(state.entries ?? {}).length)],
			["Conflicts", String(conflicts.length)],
		];
		const metrics = state.runtimeMetrics;
		if (metrics) {
			rows.push([
				"Last run",
				metrics.lastRunAt ? new Date(metrics.lastRunAt).toLocaleString() : "Never",
			]);
			rows.push([
				"Last run duration",
				metrics.lastRunDurationMs ? `${Math.round(metrics.lastRunDurationMs)} ms` : "0 ms",
			]);
			rows.push([
				"Last run throughput",
				metrics.lastRunThroughputBytesPerSec
					? `${formatBytes(metrics.lastRunThroughputBytesPerSec)}/s`
					: "0 B/s",
			]);
			rows.push([
				"Last run bytes",
				`${formatBytes(metrics.lastRunUploadBytes)} up / ${formatBytes(metrics.lastRunDownloadBytes)} down`,
			]);
			rows.push([
				"Failures (last/total)",
				`${metrics.lastRunFailures ?? 0} / ${metrics.totalFailures ?? 0}`,
			]);
			rows.push([
				"Queue peaks",
				`depth ${metrics.peakQueueDepth ?? 0}, pending ${metrics.peakPendingJobs ?? 0}, blocked ${metrics.peakBlockedJobs ?? 0}`,
			]);
		}

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

		if ((state.jobs?.length ?? 0) > 0) {
			contentEl.createEl("h3", { text: "Queue details" });
			const queueTable = contentEl.createEl("div", {
				cls: "protondrive-queue",
			});
			for (const job of (state.jobs ?? []).slice(0, 12)) {
				const row = queueTable.createEl("div", {
					cls: "protondrive-queue-row",
				});
				if (job.status === "processing") {
					row.addClass("is-processing");
				}
				row.createEl("div", { text: job.op });
				row.createEl("div", { text: job.path });
				row.createEl("div", { text: job.status ?? "pending" });
				const retryAt =
					job.nextRunAt && job.nextRunAt > nowTs
						? new Date(job.nextRunAt).toLocaleString()
						: "Ready";
				const detailText = `Attempt ${job.attempt + 1} · ${retryAt}`;
				const detail = row.createEl("div", { text: detailText });
				if (job.lastError) {
					detail.createSpan({ text: ` · ${job.lastError}` });
				}
			}
			if ((state.jobs?.length ?? 0) > 12) {
				contentEl.createEl("p", {
					text: `Showing 12 of ${state.jobs?.length ?? 0} jobs.`,
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
