import type { App, Plugin } from "obsidian";
import { loadPluginData } from "../data/plugin-data";
import { PluginDataStateStore } from "./state-store";

type DiagnosticsReport = {
	generatedAt: string;
	settings: {
		enableProtonDrive: boolean;
		remoteFolderId: string;
		accountEmail: string;
		hasSession: boolean;
		hasAuthSession: boolean;
		excludePatterns: string;
		conflictStrategy: string;
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
	logs: Array<{ at: string; message: string; context?: string }>;
};

export async function exportDiagnostics(
	app: App,
	plugin: Plugin,
	targetPath = "protondrive-sync-diagnostics.json",
): Promise<string> {
	const data = await loadPluginData(plugin);
	const syncState = await new PluginDataStateStore().load();
	const conflicts = Object.values(syncState.entries ?? {}).filter(
		(entry) => entry.conflict,
	).length;
	const report: DiagnosticsReport = {
		generatedAt: new Date().toISOString(),
		settings: {
			enableProtonDrive: data.settings.enableProtonDrive,
			remoteFolderId: redactRemoteFolderId(data.settings.remoteFolderId),
			accountEmail: data.settings.accountEmail,
			hasSession: Boolean(data.settings.protonSession),
			hasAuthSession: data.settings.hasAuthSession,
			excludePatterns: data.settings.excludePatterns,
			conflictStrategy: data.settings.conflictStrategy,
			maxConcurrentJobs: data.settings.maxConcurrentJobs,
			maxRetryAttempts: data.settings.maxRetryAttempts,
			autoSyncEnabled: data.settings.autoSyncEnabled,
			autoSyncIntervalMs: data.settings.autoSyncIntervalMs,
			localChangeDebounceMs: data.settings.localChangeDebounceMs,
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
