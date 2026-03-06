import {
	createLocalProviderRegistry,
	createRemoteProviderRegistry,
} from "./provider/default-registry";
import {
	DEFAULT_LOCAL_PROVIDER_ID,
	DEFAULT_REMOTE_PROVIDER_ID,
	type LocalProvider,
	type RemoteProvider,
	type RemoteProviderCredentials,
} from "./provider/contracts";
import { DEFAULT_SETTINGS, type ProtonDriveSettings, ProtonDriveSettingTab } from "./settings";
import { loadPluginData, mergePluginData, savePluginData } from "./data/plugin-data";
import { LocalProviderRegistry, RemoteProviderRegistry } from "./provider/registry";
import type { ObsidianDriveSyncPluginApi } from "./plugin/contracts";
import { Plugin } from "obsidian";
import { PluginRuntime } from "./runtime/plugin-runtime";
import { registerCommands } from "./commands";

type LegacySettingsSnapshot = {
	remoteFolderId?: string;
	remoteFolderPath?: string;
	protonSession?: unknown;
	accountEmail?: string;
	hasAuthSession?: boolean;
	// Legacy persisted keys from previous versions; kept only for migration.
	enableRateLimitedRemoteFileSystem?: boolean;
	enableRateLimitedRemoteFs?: boolean;
};

function normalizeString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function hasLegacySettings(snapshot: LegacySettingsSnapshot): boolean {
	return Boolean(
		snapshot.remoteFolderId ||
		snapshot.remoteFolderPath ||
		snapshot.protonSession ||
		snapshot.accountEmail ||
		typeof snapshot.hasAuthSession === "boolean" ||
		typeof snapshot.enableRateLimitedRemoteFileSystem === "boolean" ||
		typeof snapshot.enableRateLimitedRemoteFs === "boolean",
	);
}

function migrateLoadedSettings(loaded: ProtonDriveSettings): {
	settings: ProtonDriveSettings;
	migrated: boolean;
} {
	const legacy = loaded as ProtonDriveSettings & LegacySettingsSnapshot;
	const loadedProviderId = normalizeString(loaded.remoteProviderId);
	const loadedScopeId = normalizeString(loaded.remoteScopeId);
	const loadedScopePath = normalizeString(loaded.remoteScopePath);
	const loadedAccountEmail = normalizeString(loaded.remoteAccountEmail);

	const providerId = loadedProviderId || DEFAULT_REMOTE_PROVIDER_ID;
	const scopeId = loadedScopeId || normalizeString(legacy.remoteFolderId);
	const scopePath = loadedScopePath || normalizeString(legacy.remoteFolderPath);
	const credentials = loaded.remoteProviderCredentials ?? legacy.protonSession;
	const accountEmail = loadedAccountEmail || normalizeString(legacy.accountEmail);
	const hasAuthSession =
		typeof loaded.remoteHasAuthSession === "boolean"
			? loaded.remoteHasAuthSession
			: Boolean(legacy.hasAuthSession);

	const settings: ProtonDriveSettings = {
		...DEFAULT_SETTINGS,
		remoteProviderId: providerId,
		remoteScopeId: scopeId,
		remoteScopePath: scopePath,
		remoteProviderCredentials: credentials,
		remoteAccountEmail: accountEmail,
		remoteHasAuthSession: hasAuthSession,
		conflictStrategy: loaded.conflictStrategy ?? DEFAULT_SETTINGS.conflictStrategy,
		autoSyncEnabled: loaded.autoSyncEnabled ?? DEFAULT_SETTINGS.autoSyncEnabled,
		enableNetworkPolicy: loaded.enableNetworkPolicy ?? DEFAULT_SETTINGS.enableNetworkPolicy,
	};

	const migrated =
		hasLegacySettings(legacy) ||
		providerId !== loadedProviderId ||
		scopeId !== loadedScopeId ||
		scopePath !== loadedScopePath ||
		accountEmail !== loadedAccountEmail ||
		hasAuthSession !== loaded.remoteHasAuthSession ||
		credentials !== loaded.remoteProviderCredentials;

	return { settings, migrated };
}

export default class ObsidianDriveSyncPlugin extends Plugin implements ObsidianDriveSyncPluginApi {
	settings: ProtonDriveSettings = DEFAULT_SETTINGS;
	private localProviderRegistry: LocalProviderRegistry = new LocalProviderRegistry();
	private remoteProviderRegistry: RemoteProviderRegistry = new RemoteProviderRegistry();
	private runtime: PluginRuntime | null = null;

	async onload(): Promise<void> {
		const data = await loadPluginData(this);
		const { settings, migrated } = migrateLoadedSettings(data.settings);
		this.settings = settings;
		this.localProviderRegistry = createLocalProviderRegistry(this.getLocalProviderId());
		this.remoteProviderRegistry = createRemoteProviderRegistry(this.getRemoteProviderId());
		if (migrated) {
			await this.saveSettings();
		}

		this.runtime = new PluginRuntime(this);
		await this.runtime.restoreSession();

		this.addSettingTab(new ProtonDriveSettingTab(this.app, this));
		registerCommands(this);
		this.refreshAutoSync();
	}

	onunload(): void {
		this.runtime?.teardown();
	}

	getRemoteProviderId(): string {
		const providerId = this.settings.remoteProviderId.trim();
		return providerId || DEFAULT_REMOTE_PROVIDER_ID;
	}

	getRemoteProvider(): RemoteProvider {
		return this.remoteProviderRegistry.get(this.getRemoteProviderId());
	}

	getLocalProviderId(): string {
		return DEFAULT_LOCAL_PROVIDER_ID;
	}

	getLocalProvider(): LocalProvider {
		return this.localProviderRegistry.get(this.getLocalProviderId());
	}

	getRemoteScopeId(): string {
		return this.settings.remoteScopeId.trim();
	}

	getRemoteScopePath(): string {
		return this.settings.remoteScopePath.trim();
	}

	setRemoteScope(scopeId: string, scopePath: string): void {
		this.settings.remoteScopeId = scopeId.trim();
		this.settings.remoteScopePath = scopePath.trim();
	}

	getStoredProviderCredentials(): RemoteProviderCredentials | undefined {
		return this.settings.remoteProviderCredentials;
	}

	setStoredProviderCredentials(credentials: RemoteProviderCredentials | undefined): void {
		this.settings.remoteProviderCredentials = credentials;
	}

	getRemoteAccountEmail(): string {
		return this.settings.remoteAccountEmail;
	}

	setRemoteAccountEmail(email: string): void {
		this.settings.remoteAccountEmail = email.trim();
	}

	hasRemoteAuthSession(): boolean {
		return this.settings.remoteHasAuthSession;
	}

	setRemoteAuthSession(hasAuthSession: boolean): void {
		this.settings.remoteHasAuthSession = hasAuthSession;
	}

	clearStoredRemoteSession(): void {
		this.setStoredProviderCredentials(undefined);
		this.setRemoteAccountEmail("");
		this.setRemoteAuthSession(false);
	}

	async saveSettings(): Promise<void> {
		const data = mergePluginData(await loadPluginData(this));
		data.settings = {
			remoteProviderId: this.settings.remoteProviderId,
			remoteScopeId: this.settings.remoteScopeId,
			remoteScopePath: this.settings.remoteScopePath,
			remoteProviderCredentials: this.settings.remoteProviderCredentials,
			remoteAccountEmail: this.settings.remoteAccountEmail,
			remoteHasAuthSession: this.settings.remoteHasAuthSession,
			conflictStrategy: this.settings.conflictStrategy,
			autoSyncEnabled: this.settings.autoSyncEnabled,
			enableNetworkPolicy: this.settings.enableNetworkPolicy,
		};
		await savePluginData(this, data);
	}

	refreshAutoSync(): void {
		this.runtime?.refreshAutoSync();
	}

	pauseAutoSync(): void {
		this.runtime?.pauseAutoSync();
	}

	resumeAutoSync(): void {
		this.runtime?.resumeAutoSync();
	}

	isAutoSyncPaused(): boolean {
		return this.runtime?.isAutoSyncPaused() ?? false;
	}

	isAuthPaused(): boolean {
		return this.runtime?.isAuthPaused() ?? false;
	}

	getLastAuthError(): string | undefined {
		return this.runtime?.getLastAuthError();
	}

	async runAutoSync(force = false): Promise<void> {
		if (!this.runtime) {
			return;
		}
		await this.runtime.runAutoSync(force);
	}

	isSyncRunning(): boolean {
		return this.runtime?.isSyncRunning() ?? false;
	}

	handleAuthRecovered(scheduleSync = true): void {
		this.runtime?.handleAuthRecovered(scheduleSync);
	}
}
