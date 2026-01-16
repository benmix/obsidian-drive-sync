import type { App } from "obsidian";
import { loadPluginData } from "../data/plugin-data";

type DiagnosticsReport = {
	generatedAt: string;
	settings: {
		enableProtonDrive: boolean;
		remoteFolderId: string;
		accountEmail: string;
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
	};
};

export async function exportDiagnostics(
	app: App,
	targetPath = "protondrive-sync-diagnostics.json",
): Promise<string> {
	const data = loadPluginData(app);
	const report: DiagnosticsReport = {
		generatedAt: new Date().toISOString(),
		settings: {
			enableProtonDrive: data.settings.enableProtonDrive,
			remoteFolderId: data.settings.remoteFolderId,
			accountEmail: data.settings.accountEmail,
			autoSyncEnabled: data.settings.autoSyncEnabled,
			autoSyncIntervalMs: data.settings.autoSyncIntervalMs,
			localChangeDebounceMs: data.settings.localChangeDebounceMs,
		},
		syncState: {
			entries: Object.keys(data.syncState.entries ?? {}).length,
			jobs: data.syncState.jobs?.length ?? 0,
			lastSyncAt: data.syncState.lastSyncAt,
			lastError: data.syncState.lastError,
			lastErrorAt: data.syncState.lastErrorAt,
		},
	};

	await app.vault.adapter.write(targetPath, JSON.stringify(report, null, 2));
	return targetPath;
}
