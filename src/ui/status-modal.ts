import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";

import type { DriveSyncErrorCode } from "../contracts/data/error-types";
import type { SyncJob } from "../contracts/data/sync-schema";
import type { ObsidianDriveSyncPluginApi } from "../contracts/plugin/plugin-api";
import { getDriveSyncErrorMessageForCode } from "../errors";
import { tr, trAny } from "../i18n";

import { formatBytes } from "./format";

export class SyncStatusModal extends Modal {
	private plugin: ObsidianDriveSyncPluginApi;

	constructor(app: App, plugin: ObsidianDriveSyncPluginApi) {
		super(app);
		this.plugin = plugin;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("drive-sync-status-modal");

		const provider = this.plugin.getRemoteProvider();
		const state = await this.plugin.loadSyncState();
		const conflicts = Object.values(state.entries ?? {}).filter((entry) => entry.conflict);
		const entriesTracked = Object.keys(state.entries ?? {}).length;
		const logs = state.logs ?? [];
		const taskLogs = logs.filter((entry) => entry.context === "task");
		const jobs = state.jobs ?? [];
		const nowTs = Date.now();
		const authPaused = this.plugin.isAuthPaused();
		const autoSyncPaused = this.plugin.isAutoSyncPaused() || authPaused;

		const autoSyncStatus = this.plugin.settings.autoSyncEnabled
			? autoSyncPaused
				? tr("status.autoSync.paused")
				: tr("status.autoSync.running")
			: tr("status.autoSync.disabled");
		const syncActivity = this.plugin.isSyncRunning()
			? tr("status.inProgress")
			: tr("status.idle");
		const authStatus = authPaused
			? tr("status.authPaused")
			: this.plugin.hasRemoteAuthSession()
				? provider.isSessionValidated()
					? tr("status.authOk")
					: tr("status.authPending")
				: tr("status.signedOut");
		const authError = authPaused ? this.plugin.getLastAuthError() : undefined;

		const queueMeta = this.collectQueueMeta(jobs, nowTs);

		const layout = contentEl.createDiv({ cls: "drive-sync-status-layout" });

		const header = layout.createDiv({ cls: "drive-sync-status-header" });
		header.createEl("h2", {
			text: tr("status.title"),
		});
		header.createDiv({
			cls: "drive-sync-status-header-meta",
			text: `${tr("status.lastSync")}: ${
				state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString() : tr("status.never")
			}`,
		});
		const chips = header.createDiv({ cls: "drive-sync-status-chips" });
		this.renderChip(
			chips,
			tr("status.syncActivity"),
			syncActivity,
			this.plugin.isSyncRunning() ? "active" : "idle",
		);
		this.renderChip(chips, tr("status.authStatus"), authStatus, authPaused ? "warn" : "ok");
		this.renderChip(
			chips,
			tr("status.autoSync"),
			autoSyncStatus,
			autoSyncPaused ? "warn" : "ok",
		);

		if (this.plugin.settings.autoSyncEnabled && !authPaused) {
			const controlWrap = header.createDiv({
				cls: "drive-sync-status-control",
			});
			new Setting(controlWrap).addButton((button) => {
				button.setButtonText(
					this.plugin.isAutoSyncPaused()
						? tr("status.resumeAutoSync")
						: tr("status.pauseAutoSync"),
				);
				button.onClick(() => {
					if (this.plugin.isAutoSyncPaused()) {
						this.plugin.resumeAutoSync();
					} else {
						this.plugin.pauseAutoSync();
					}
					void this.onOpen();
				});
			});
		}

		if (authError) {
			const authAlert = header.createDiv({
				cls: "drive-sync-status-alert is-warn",
			});
			authAlert.createDiv({
				cls: "drive-sync-status-alert-label",
				text: tr("status.authStatus"),
			});
			authAlert.createDiv({
				cls: "drive-sync-status-alert-message",
				text: authError,
			});
		}

		const summary = layout.createDiv({ cls: "drive-sync-status-summary" });
		this.renderSummaryCard(summary, tr("status.jobsQueued"), String(jobs.length));
		this.renderSummaryCard(
			summary,
			tr("status.syncStrategy"),
			this.plugin.settings.syncStrategy,
		);
		this.renderSummaryCard(summary, tr("status.entriesTracked"), String(entriesTracked));
		this.renderSummaryCard(summary, tr("status.conflicts"), String(conflicts.length));
		this.renderSummaryCard(
			summary,
			`${tr("status.jobsByState")} · ${tr("status.pending")}`,
			String(queueMeta.pending),
		);
		this.renderSummaryCard(
			summary,
			`${tr("status.jobsByState")} · ${tr("status.inProgress")}`,
			String(queueMeta.processing),
		);
		this.renderSummaryCard(
			summary,
			`${tr("status.jobsByState")} · ${tr("status.blocked")}`,
			String(queueMeta.blocked),
		);
		this.renderSummaryCard(
			summary,
			tr("status.nextRetry"),
			queueMeta.nextRetryAt
				? tr("status.nextRetryValue", {
						time: new Date(queueMeta.nextRetryAt).toLocaleString(),
						count: queueMeta.nextRetryCount,
					})
				: tr("status.none"),
		);
		this.renderSummaryCard(
			summary,
			tr("status.inFlightJob"),
			queueMeta.inFlightJob ?? tr("status.none"),
		);
		this.renderSummaryCard(summary, tr("status.lastError"), this.formatLastError(state));

		const metrics = state.runtimeMetrics;
		if (metrics) {
			this.renderSummaryCard(
				summary,
				tr("status.lastRun"),
				metrics.lastRunAt
					? new Date(metrics.lastRunAt).toLocaleString()
					: tr("status.never"),
			);
			this.renderSummaryCard(
				summary,
				tr("status.lastRunDuration"),
				tr("status.lastRunDurationMs", {
					value: metrics.lastRunDurationMs ? Math.round(metrics.lastRunDurationMs) : 0,
				}),
			);
			this.renderSummaryCard(
				summary,
				tr("status.lastRunThroughput"),
				metrics.lastRunThroughputBytesPerSec
					? tr("status.lastRunThroughputValue", {
							value: formatBytes(metrics.lastRunThroughputBytesPerSec),
						})
					: tr("status.lastRunThroughputValue", { value: "0 B" }),
			);
			this.renderSummaryCard(
				summary,
				tr("status.lastRunBytes"),
				tr("status.lastRunBytesValue", {
					up: formatBytes(metrics.lastRunUploadBytes),
					down: formatBytes(metrics.lastRunDownloadBytes),
				}),
			);
		}

		const sections = layout.createDiv({
			cls: "drive-sync-status-sections",
		});

		const queueSection = this.renderSection(sections, tr("status.queueDetails"));
		if (jobs.length === 0) {
			queueSection.createDiv({
				cls: "drive-sync-status-empty",
				text: tr("status.none"),
			});
		} else {
			const queueList = queueSection.createEl("div", {
				cls: "drive-sync-queue",
			});
			for (const job of jobs.slice(0, 12)) {
				this.renderQueueRow(queueList, job, nowTs);
			}
			if (jobs.length > 12) {
				queueSection.createEl("p", {
					cls: "drive-sync-status-section-footnote",
					text: tr("status.showingJobs", { count: jobs.length }),
				});
			}
		}

		if (conflicts.length > 0) {
			const conflictSection = this.renderSection(sections, tr("status.conflictsNeedReview"));
			const conflictList = conflictSection.createDiv({
				cls: "drive-sync-status-conflicts",
			});
			for (const conflict of conflicts.slice(0, 10)) {
				conflictList.createDiv({
					cls: "drive-sync-status-conflict-item",
					text: conflict.relPath,
				});
			}
			if (conflicts.length > 10) {
				conflictSection.createEl("p", {
					cls: "drive-sync-status-section-footnote",
					text: tr("status.andMore", {
						count: conflicts.length - 10,
					}),
				});
			}
		}

		const taskStatusSection = this.renderSection(sections, tr("status.recentTasks"));
		if (taskLogs.length === 0) {
			taskStatusSection.createDiv({
				cls: "drive-sync-status-empty",
				text: tr("status.none"),
			});
		} else {
			const taskStatusList = taskStatusSection.createDiv({
				cls: "drive-sync-task-status-list",
			});
			for (const entry of taskLogs.slice(-12).reverse()) {
				const row = taskStatusList.createDiv({
					cls: "drive-sync-task-status-row",
				});
				row.createDiv({
					cls: "drive-sync-task-status-time",
					text: new Date(entry.at).toLocaleString(),
				});
				row.createDiv({
					cls: "drive-sync-task-status-message",
					text: entry.message,
				});
			}
		}

		const logsSection = this.renderSection(sections, tr("status.syncLogs"));
		if (logs.length === 0) {
			logsSection.createDiv({
				cls: "drive-sync-status-empty",
				text: tr("status.none"),
			});
		} else {
			const logList = logsSection.createEl("div", {
				cls: "drive-sync-logs",
			});
			for (const entry of logs.slice(-20)) {
				const row = logList.createEl("div", {
					cls: "drive-sync-log-row",
				});
				row.createEl("div", {
					cls: "drive-sync-log-time",
					text: entry.at,
				});
				row.createEl("div", {
					cls: "drive-sync-log-context",
					text: entry.context ?? tr("status.general"),
				});
				row.createEl("div", {
					cls: "drive-sync-log-message",
					text: entry.message,
				});
			}
		}
	}

	private renderSection(container: HTMLElement, title: string): HTMLDivElement {
		const section = container.createDiv({
			cls: "drive-sync-status-section",
		});
		section.createEl("h3", { text: title });
		return section;
	}

	private renderChip(
		container: HTMLElement,
		label: string,
		value: string,
		tone: "ok" | "warn" | "active" | "idle",
	): void {
		const chip = container.createDiv({
			cls: `drive-sync-status-chip is-${tone}`,
		});
		chip.createSpan({
			cls: "drive-sync-status-chip-label",
			text: `${label}:`,
		});
		chip.createSpan({ cls: "drive-sync-status-chip-value", text: value });
	}

	private renderSummaryCard(container: HTMLElement, label: string, value: string): void {
		const card = container.createDiv({ cls: "drive-sync-status-card" });
		card.createDiv({ cls: "drive-sync-status-card-label", text: label });
		card.createDiv({ cls: "drive-sync-status-card-value", text: value });
	}

	private renderQueueRow(container: HTMLElement, job: SyncJob, nowTs: number): void {
		const status = job.status ?? "pending";
		const statusLabel = this.renderJobStatus(status);
		const row = container.createEl("div", {
			cls: `drive-sync-queue-row is-${status}`,
		});

		const top = row.createDiv({ cls: "drive-sync-queue-top" });
		top.createDiv({ cls: "drive-sync-queue-op", text: job.op });
		top.createDiv({ cls: "drive-sync-queue-status", text: statusLabel });

		row.createDiv({ cls: "drive-sync-queue-path", text: job.path });

		const retryAt =
			job.nextRunAt && job.nextRunAt > nowTs
				? new Date(job.nextRunAt).toLocaleString()
				: tr("status.ready");
		row.createEl("div", {
			cls: "drive-sync-queue-attempt",
			text: tr("status.attemptValue", {
				attempt: job.attempt + 1,
				retryAt,
			}),
		});

		if (job.lastErrorCode) {
			row.createDiv({
				cls: "drive-sync-queue-error",
				text: this.formatJobError(job),
			});
		}
	}

	private formatLastError(state: {
		lastErrorCode?: DriveSyncErrorCode;
		lastErrorAt?: number;
	}): string {
		if (!state.lastErrorCode) {
			return tr("status.none");
		}
		const parts = [getDriveSyncErrorMessageForCode(state.lastErrorCode, trAny)];
		if (state.lastErrorCode) {
			parts.push(`[${state.lastErrorCode}]`);
		}
		if (state.lastErrorAt) {
			parts.push(new Date(state.lastErrorAt).toLocaleString());
		}
		return parts.join(" ");
	}

	private formatJobError(job: SyncJob): string {
		const parts = [getDriveSyncErrorMessageForCode(job.lastErrorCode, trAny)];
		if (job.lastErrorCode) {
			parts.push(`[${job.lastErrorCode}]`);
		}
		if (job.lastErrorAt) {
			parts.push(new Date(job.lastErrorAt).toLocaleString());
		}
		return parts.join(" ");
	}

	private renderJobStatus(status: SyncJob["status"]): string {
		if (status === "processing") {
			return tr("status.inProgress");
		}
		if (status === "pending" || !status) {
			return tr("status.pending");
		}
		if (status === "blocked") {
			return tr("status.blocked");
		}
		return status;
	}

	private collectQueueMeta(
		jobs: SyncJob[],
		nowTs: number,
	): {
		pending: number;
		processing: number;
		blocked: number;
		nextRetryAt: number | null;
		nextRetryCount: number;
		inFlightJob: string | null;
	} {
		let pending = 0;
		let processing = 0;
		let blocked = 0;
		let nextRetryAt: number | null = null;
		let nextRetryCount = 0;
		let inFlightJob: string | null = null;

		for (const job of jobs) {
			if (job.status === "processing") {
				processing += 1;
				if (!inFlightJob) {
					inFlightJob = `${job.op} · ${job.path}`;
				}
			} else if (job.status === "blocked") {
				blocked += 1;
			} else {
				pending += 1;
			}
			if (job.nextRunAt && job.nextRunAt > nowTs) {
				nextRetryCount += 1;
				if (!nextRetryAt || job.nextRunAt < nextRetryAt) {
					nextRetryAt = job.nextRunAt;
				}
			}
		}

		return {
			pending,
			processing,
			blocked,
			nextRetryAt,
			nextRetryCount,
			inFlightJob,
		};
	}
}
