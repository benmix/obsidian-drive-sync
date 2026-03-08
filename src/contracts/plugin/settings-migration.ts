import { DEFAULT_SETTINGS } from "./default-settings";
import type { DriveSyncSettings } from "./settings";
import { isSupportedRemoteProviderId } from "../provider/provider-ids";
import { normalizeSyncStrategy } from "../sync/strategy";

function normalizeString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

export function migrateLoadedSettings(loaded: DriveSyncSettings): {
	settings: DriveSyncSettings;
	migrated: boolean;
} {
	const loadedProviderId = normalizeString(loaded.remoteProviderId);
	const loadedScopeId = normalizeString(loaded.remoteScopeId);
	const loadedScopePath = normalizeString(loaded.remoteScopePath);
	const loadedAccountEmail = normalizeString(loaded.remoteAccountEmail);
	const normalizedSyncStrategy = normalizeSyncStrategy(loaded.syncStrategy);

	const nextProviderId = loadedProviderId || DEFAULT_SETTINGS.remoteProviderId;
	const providerId = isSupportedRemoteProviderId(nextProviderId)
		? nextProviderId
		: DEFAULT_SETTINGS.remoteProviderId;
	const scopeId = loadedScopeId;
	const scopePath = loadedScopePath;
	const credentials = loaded.remoteProviderCredentials;
	const accountEmail = loadedAccountEmail;
	const hasAuthSession =
		typeof loaded.remoteHasAuthSession === "boolean"
			? loaded.remoteHasAuthSession
			: DEFAULT_SETTINGS.remoteHasAuthSession;

	const settings: DriveSyncSettings = {
		...DEFAULT_SETTINGS,
		remoteProviderId: providerId,
		remoteScopeId: scopeId,
		remoteScopePath: scopePath,
		remoteProviderCredentials: credentials,
		remoteAccountEmail: accountEmail,
		remoteHasAuthSession: hasAuthSession,
		syncStrategy: normalizedSyncStrategy ?? DEFAULT_SETTINGS.syncStrategy,
		autoSyncEnabled: loaded.autoSyncEnabled ?? DEFAULT_SETTINGS.autoSyncEnabled,
		enableNetworkPolicy: loaded.enableNetworkPolicy ?? DEFAULT_SETTINGS.enableNetworkPolicy,
	};

	const migrated =
		providerId !== loadedProviderId ||
		scopeId !== loadedScopeId ||
		scopePath !== loadedScopePath ||
		accountEmail !== loadedAccountEmail ||
		hasAuthSession !== loaded.remoteHasAuthSession ||
		credentials !== loaded.remoteProviderCredentials ||
		normalizedSyncStrategy !== loaded.syncStrategy;

	return { settings, migrated };
}
