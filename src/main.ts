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
	type RemoteProviderSession,
} from "./provider/contracts";
import { DEFAULT_SETTINGS, DriveSyncSettingTab } from "./settings";
import { loadPluginData, mergePluginData, savePluginData } from "./data/plugin-data";
import { LocalProviderRegistry, RemoteProviderRegistry } from "./provider/registry";
import type { DriveSyncSettings } from "./contracts/settings";
import { normalizeSyncStrategy } from "./sync/contracts/strategy";
import type { ObsidianDriveSyncPluginApi } from "./plugin/contracts";
import { Plugin } from "obsidian";
import { PluginDataStateStore } from "./sync/state/state-store";
import { PluginRuntime } from "./runtime/plugin-runtime";
import { registerCommands } from "./commands";
import type { SyncState } from "./sync/state/index-store";

function normalizeString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function migrateLoadedSettings(loaded: DriveSyncSettings): {
	settings: DriveSyncSettings;
	migrated: boolean;
} {
	const loadedProviderId = normalizeString(loaded.remoteProviderId);
	const loadedScopeId = normalizeString(loaded.remoteScopeId);
	const loadedScopePath = normalizeString(loaded.remoteScopePath);
	const loadedAccountEmail = normalizeString(loaded.remoteAccountEmail);
	const normalizedSyncStrategy = normalizeSyncStrategy(loaded.syncStrategy);

	const providerId = loadedProviderId || DEFAULT_REMOTE_PROVIDER_ID;
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

export default class ObsidianDriveSyncPlugin extends Plugin implements ObsidianDriveSyncPluginApi {
	settings: DriveSyncSettings = DEFAULT_SETTINGS;
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

		this.addSettingTab(new DriveSyncSettingTab(this.app, this));
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
			syncStrategy: this.settings.syncStrategy,
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

	async buildActiveRemoteSession(): Promise<RemoteProviderSession | null> {
		return (await this.runtime?.buildActiveRemoteSession()) ?? null;
	}

	async connectRemoteClient(): Promise<unknown | null> {
		return (await this.runtime?.connectRemoteClient()) ?? null;
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

	async loadSyncState(): Promise<SyncState> {
		return await new PluginDataStateStore().load();
	}

	async clearConflictMarker(path: string): Promise<boolean> {
		const stateStore = new PluginDataStateStore();
		const state = await stateStore.load();
		const entry = state.entries[path];
		if (!entry) {
			return false;
		}
		entry.conflict = undefined;
		entry.conflictPending = undefined;
		state.entries[path] = entry;
		await stateStore.save(state);
		return true;
	}
}
