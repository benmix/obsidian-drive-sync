import type { App, Plugin } from "obsidian";

import { loadPluginData } from "../../data/plugin-data";
import {
	INTERNAL_AUTO_SYNC_INTERVAL_MS,
	INTERNAL_LOCAL_CHANGE_DEBOUNCE_MS,
	INTERNAL_MAX_CONCURRENT_JOBS,
	INTERNAL_MAX_RETRY_ATTEMPTS,
} from "../../internal-config";
import { getBuiltInExcludePatterns } from "../../sync/planner/exclude";
import { PluginDataStateStore } from "../../sync/state/state-store";
import { formatBytes } from "../../sync/support/utils";

type DiagnosticsReport = {
	generatedAt: string;
	settings: {
		remoteProviderId: string;
		remoteScopeId: string;
		accountEmail: string;
		hasSession: boolean;
		hasAuthSession: boolean;
		builtInExcludePatterns: string[];
		syncStrategy: string;
		maxConcurrentJobs: number;
		maxRetryAttempts: number;
		autoSyncEnabled: boolean;
		autoSyncIntervalMs: number;
		localChangeDebounceMs: number;
	};
	syncState: {
		entries: number;
		jobs: number;
		lastSyncAt?: number;
		lastError?: string;
		lastErrorAt?: number;
		remoteEventCursor?: string;
		conflicts: number;
	};
	runtimeMetrics?: {
		lastRunAt?: number;
		lastRunDurationMs?: number;
		lastRunJobsExecuted?: number;
		lastRunEntriesUpdated?: number;
		lastRunFailures?: number;
		lastRunUploadBytes?: number;
		lastRunDownloadBytes?: number;
		lastRunThroughputBytesPerSec?: number;
		totalRuns?: number;
		totalFailures?: number;
		totalUploadBytes?: number;
		totalDownloadBytes?: number;
		peakQueueDepth?: number;
		peakPendingJobs?: number;
		peakBlockedJobs?: number;
		formatted?: {
			lastRunDuration?: string;
			lastRunUpload?: string;
			lastRunDownload?: string;
			lastRunThroughput?: string;
			totalUpload?: string;
			totalDownload?: string;
		};
	};
	logs: Array<{ at: string; message: string; context?: string }>;
};

export async function exportDiagnostics(
	app: App,
	plugin: Plugin,
	targetPath = "drive-sync-diagnostics.json",
): Promise<string> {
	const data = await loadPluginData(plugin);
	const syncState = await new PluginDataStateStore().load();
	const conflicts = Object.values(syncState.entries ?? {}).filter(
		(entry) => entry.conflict,
	).length;
	const providerId = data.settings.remoteProviderId || "proton-drive";
	const scopeId = data.settings.remoteScopeId;
	const accountEmail = data.settings.remoteAccountEmail;
	const credentials = data.settings.remoteProviderCredentials;
	const hasAuthSession = data.settings.remoteHasAuthSession;
	const runtimeMetrics = syncState.runtimeMetrics;
	const report: DiagnosticsReport = {
		generatedAt: new Date().toISOString(),
		settings: {
			remoteProviderId: providerId,
			remoteScopeId: redactRemoteFolderId(scopeId),
			accountEmail,
			hasSession: Boolean(credentials),
			hasAuthSession,
			builtInExcludePatterns: getBuiltInExcludePatterns(),
			syncStrategy: data.settings.syncStrategy,
			maxConcurrentJobs: INTERNAL_MAX_CONCURRENT_JOBS,
			maxRetryAttempts: INTERNAL_MAX_RETRY_ATTEMPTS,
			autoSyncEnabled: data.settings.autoSyncEnabled,
			autoSyncIntervalMs: INTERNAL_AUTO_SYNC_INTERVAL_MS,
			localChangeDebounceMs: INTERNAL_LOCAL_CHANGE_DEBOUNCE_MS,
		},
		syncState: {
			entries: Object.keys(syncState.entries ?? {}).length,
			jobs: syncState.jobs?.length ?? 0,
			lastSyncAt: syncState.lastSyncAt,
			lastError: syncState.lastError,
			lastErrorAt: syncState.lastErrorAt,
			remoteEventCursor: syncState.remoteEventCursor
				? redactCursor(syncState.remoteEventCursor)
				: undefined,
			conflicts,
		},
		runtimeMetrics: runtimeMetrics
			? {
					...runtimeMetrics,
					formatted: {
						lastRunDuration: runtimeMetrics.lastRunDurationMs
							? `${Math.round(runtimeMetrics.lastRunDurationMs)} ms`
							: "0 ms",
						lastRunUpload: formatBytes(runtimeMetrics.lastRunUploadBytes),
						lastRunDownload: formatBytes(runtimeMetrics.lastRunDownloadBytes),
						lastRunThroughput: runtimeMetrics.lastRunThroughputBytesPerSec
							? `${formatBytes(runtimeMetrics.lastRunThroughputBytesPerSec)}/s`
							: "0 B/s",
						totalUpload: formatBytes(runtimeMetrics.totalUploadBytes),
						totalDownload: formatBytes(runtimeMetrics.totalDownloadBytes),
					},
				}
			: undefined,
		logs: redactLogs(syncState.logs ?? []),
	};

	await app.vault.adapter.write(targetPath, JSON.stringify(report, null, 2));
	return targetPath;
}

function redactRemoteFolderId(id: string): string {
	if (!id) {
		return "";
	}
	if (id.length <= 6) {
		return "***";
	}
	return `${id.slice(0, 3)}...${id.slice(-3)}`;
}

function redactCursor(cursor: string): string {
	if (cursor.length <= 6) {
		return "***";
	}
	return `${cursor.slice(0, 3)}...${cursor.slice(-3)}`;
}

function redactLogs(
	logs: Array<{ at: string; message: string; context?: string }>,
): Array<{ at: string; message: string; context?: string }> {
	return logs.map((log) => ({
		...log,
		message: log.message.replace(/[A-Za-z0-9_-]{12,}/g, "***"),
	}));
}
