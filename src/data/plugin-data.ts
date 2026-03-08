import { DEFAULT_SETTINGS } from "../contracts/default-settings";
import type { DriveSyncSettings } from "../contracts/settings";

export type PluginDataStore = {
	loadData: () => Promise<unknown>;
	saveData: (data: unknown) => Promise<void>;
};

export type PluginData = {
	settings: DriveSyncSettings;
};

export function serializeSettings(settings: DriveSyncSettings): DriveSyncSettings {
	return {
		...DEFAULT_SETTINGS,
		...settings,
	};
}

export function buildDefaultData(): PluginData {
	return {
		settings: { ...DEFAULT_SETTINGS },
	};
}

export function mergePluginData(raw: unknown): PluginData {
	const base = buildDefaultData();
	if (!raw || typeof raw !== "object") {
		return base;
	}
	const data = raw as Partial<PluginData>;
	return {
		settings: serializeSettings(data.settings ?? base.settings),
	};
}

export async function loadPluginData(store: PluginDataStore): Promise<PluginData> {
	try {
		const raw = await store.loadData();
		if (!raw) {
			return buildDefaultData();
		}
		return mergePluginData(raw);
	} catch (error) {
		console.warn("Failed to load plugin data.", error);
		return buildDefaultData();
	}
}

export async function savePluginData(store: PluginDataStore, data: PluginData): Promise<void> {
	await store.saveData(data);
}
