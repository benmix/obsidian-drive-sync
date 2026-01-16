import type { App } from "obsidian";
import type { ProtonDriveSettings } from "../settings";
import type { SyncState } from "../sync/index-types";
import { DEFAULT_SETTINGS } from "../settings";
import { DEFAULT_SYNC_STATE } from "../sync/index-types";

export const STORAGE_KEY = "protondrive-sync-state";

export type PluginData = {
	settings: ProtonDriveSettings;
	syncState: SyncState;
};

export function buildDefaultData(): PluginData {
	return {
		settings: { ...DEFAULT_SETTINGS },
		syncState: { ...DEFAULT_SYNC_STATE },
	};
}

export function mergePluginData(raw: unknown): PluginData {
	const base = buildDefaultData();
	if (!raw || typeof raw !== "object") {
		return base;
	}
	const data = raw as Partial<PluginData>;
	return {
		settings: {
			...base.settings,
			...(data.settings ?? {}),
		},
		syncState: {
			...base.syncState,
			...(data.syncState ?? {}),
			entries: data.syncState?.entries ?? base.syncState.entries,
			jobs: data.syncState?.jobs ?? base.syncState.jobs,
		},
	};
}

export function loadPluginData(app: App): PluginData {
	const raw = app.loadLocalStorage(STORAGE_KEY);
	if (!raw) {
		return buildDefaultData();
	}
	try {
		const parsed = JSON.parse(raw);
		return mergePluginData(parsed);
	} catch (error) {
		console.warn("Failed to parse Proton Drive local storage data.", error);
		return buildDefaultData();
	}
}

export function savePluginData(app: App, data: PluginData): void {
	app.saveLocalStorage(STORAGE_KEY, JSON.stringify(data));
}
