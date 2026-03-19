import type { PluginData, PluginDataStore } from "@contracts/data/plugin-data";
import { DEFAULT_SETTINGS } from "@contracts/plugin/default-settings";
import type { DriveSyncSettings } from "@contracts/plugin/settings";
import { isSupportedRemoteProviderId } from "@contracts/provider/provider-ids";
import { normalizeSyncStrategy } from "@contracts/sync/strategy";

function normalizeString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

export function serializeSettings(settings: Partial<DriveSyncSettings>): DriveSyncSettings {
	const merged = {
		...DEFAULT_SETTINGS,
		...settings,
	};
	const providerId = normalizeString(merged.remoteProviderId);
	const syncStrategy = normalizeSyncStrategy(merged.syncStrategy);
	return {
		...merged,
		remoteProviderId: isSupportedRemoteProviderId(providerId)
			? providerId
			: DEFAULT_SETTINGS.remoteProviderId,
		remoteScopeId: normalizeString(merged.remoteScopeId),
		remoteScopePath: normalizeString(merged.remoteScopePath),
		remoteAccountEmail: normalizeString(merged.remoteAccountEmail),
		remoteHasAuthSession:
			typeof merged.remoteHasAuthSession === "boolean"
				? merged.remoteHasAuthSession
				: DEFAULT_SETTINGS.remoteHasAuthSession,
		syncStrategy: syncStrategy ?? DEFAULT_SETTINGS.syncStrategy,
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
