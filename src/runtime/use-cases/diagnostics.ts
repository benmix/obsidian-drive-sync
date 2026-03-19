import {
	INTERNAL_AUTO_SYNC_INTERVAL_MS,
	INTERNAL_LOCAL_CHANGE_DEBOUNCE_MS,
	INTERNAL_MAX_CONCURRENT_JOBS,
	INTERNAL_MAX_RETRY_ATTEMPTS,
} from "@config";
import { loadPluginData } from "@data/plugin-data";
import { getBuiltInExcludePatterns } from "@sync/planner/exclude";
import { PluginDataStateStore } from "@sync/state/state-store";
import { formatBytes } from "@sync/support/utils";
import type { App, Plugin } from "obsidian";

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
		lastErrorAt?: number;
		lastErrorCode?: string;
		lastErrorCategory?: string;
		lastErrorRetryable?: boolean;
		remoteEventCursor?: string;
		conflicts: number;
		jobErrors: Array<{
			id: string;
			op: string;
			path: string;
			status?: string;
			attempt: number;
			nextRunAt: number;
			lastErrorCode?: string;
			lastErrorRetryable?: boolean;
			lastErrorAt?: number;
		}>;
		recentErrors: Array<{
			at: string;
			message: string;
			context?: string;
			code?: string;
			category?: string;
			retryable?: boolean;
			path?: string;
			jobId?: string;
			jobOp?: string;
			provider?: string;
		}>;
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
	logs: Array<{
		at: string;
		message: string;
		context?: string;
		code?: string;
		category?: string;
		retryable?: boolean;
		path?: string;
		jobId?: string;
		jobOp?: string;
		provider?: string;
	}>;
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
			accountEmail: redactEmail(accountEmail),
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
			lastErrorAt: syncState.lastErrorAt,
			lastErrorCode: syncState.lastErrorCode,
			lastErrorCategory: syncState.lastErrorCategory,
			lastErrorRetryable: syncState.lastErrorRetryable,
			remoteEventCursor: syncState.remoteEventCursor
				? redactCursor(syncState.remoteEventCursor)
				: undefined,
			conflicts,
			jobErrors: (syncState.jobs ?? [])
				.filter((job) => job.lastErrorCode)
				.map((job) => ({
					id: job.id,
					op: job.op,
					path: redactPath(job.path),
					status: job.status,
					attempt: job.attempt,
					nextRunAt: job.nextRunAt,
					lastErrorCode: job.lastErrorCode,
					lastErrorRetryable: job.lastErrorRetryable,
					lastErrorAt: job.lastErrorAt,
				})),
			recentErrors: redactLogs(syncState.logs ?? [])
				.filter((log) => log.code)
				.slice(-20),
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

function redactEmail(email: string): string {
	if (!email) {
		return "";
	}
	const [localPart = "", domain = ""] = email.split("@");
	if (!domain) {
		return "***";
	}
	const [domainName = "", ...rest] = domain.split(".");
	const suffix = rest.length > 0 ? `.${rest.join(".")}` : "";
	return `${redactFragment(localPart)}@${redactFragment(domainName)}${suffix}`;
}

function redactFragment(value: string): string {
	if (!value) {
		return "***";
	}
	if (value.length <= 2) {
		return `${value[0] ?? "*"}***`;
	}
	return `${value[0]}***${value.slice(-1)}`;
}

function redactPath(path: string): string;
function redactPath(path?: string): string | undefined;
function redactPath(path?: string): string | undefined {
	if (!path) {
		return path;
	}
	const extensionIndex = path.lastIndexOf(".");
	if (extensionIndex <= 0 || extensionIndex === path.length - 1) {
		return "***";
	}
	return `***${path.slice(extensionIndex)}`;
}

function redactLogs(
	logs: Array<{
		at: string;
		message: string;
		context?: string;
		code?: string;
		category?: string;
		retryable?: boolean;
		path?: string;
		jobId?: string;
		jobOp?: string;
		provider?: string;
	}>,
): Array<{
	at: string;
	message: string;
	context?: string;
	code?: string;
	category?: string;
	retryable?: boolean;
	path?: string;
	jobId?: string;
	jobOp?: string;
	provider?: string;
}> {
	return logs.map((log) => ({
		...log,
		message: log.message.replace(/[A-Za-z0-9_-]{12,}/g, "***"),
		path: redactPath(log.path),
		jobId: log.jobId?.replace(/[A-Za-z0-9_-]{12,}/g, "***"),
	}));
}
