import {
	clearConflictMarker as clearConflictMarkerUseCase,
	loadSyncState as loadSyncStateUseCase,
} from "./runtime/use-cases/sync-state";
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
import {
	loadPluginData,
	mergePluginData,
	savePluginData,
	serializeSettings,
} from "./data/plugin-data";
import { LocalProviderRegistry, RemoteProviderRegistry } from "./provider/registry";
import { DEFAULT_SETTINGS } from "./contracts/default-settings";
import type { DriveSyncSettings } from "./contracts/settings";
import { DriveSyncSettingTab } from "./settings";
import { migrateLoadedSettings } from "./contracts/settings-migration";
import type { ObsidianDriveSyncPluginApi } from "./plugin/contracts";
import { Plugin } from "obsidian";
import { PluginRuntime } from "./runtime/plugin-runtime";
import { registerCommands } from "./commands";

export default class ObsidianDriveSyncPlugin extends Plugin implements ObsidianDriveSyncPluginApi {
	private mutableSettings: DriveSyncSettings = { ...DEFAULT_SETTINGS };
	private localProviderRegistry: LocalProviderRegistry = new LocalProviderRegistry();
	private remoteProviderRegistry: RemoteProviderRegistry = new RemoteProviderRegistry();
	private runtime: PluginRuntime | null = null;

	async onload(): Promise<void> {
		const data = await loadPluginData(this);
		const { settings, migrated } = migrateLoadedSettings(data.settings);
		this.mutableSettings = settings;
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
		const providerId = this.mutableSettings.remoteProviderId.trim();
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
		return this.mutableSettings.remoteScopeId.trim();
	}

	getRemoteScopePath(): string {
		return this.mutableSettings.remoteScopePath.trim();
	}

	setRemoteScope(scopeId: string, scopePath: string): void {
		this.updateSettings({
			remoteScopeId: scopeId.trim(),
			remoteScopePath: scopePath.trim(),
		});
	}

	getStoredProviderCredentials(): RemoteProviderCredentials | undefined {
		return this.mutableSettings.remoteProviderCredentials;
	}

	setStoredProviderCredentials(credentials: RemoteProviderCredentials | undefined): void {
		this.updateSettings({
			remoteProviderCredentials: credentials,
		});
	}

	getRemoteAccountEmail(): string {
		return this.mutableSettings.remoteAccountEmail;
	}

	setRemoteAccountEmail(email: string): void {
		this.updateSettings({
			remoteAccountEmail: email.trim(),
		});
	}

	hasRemoteAuthSession(): boolean {
		return this.mutableSettings.remoteHasAuthSession;
	}

	setRemoteAuthSession(hasAuthSession: boolean): void {
		this.updateSettings({
			remoteHasAuthSession: hasAuthSession,
		});
	}

	clearStoredRemoteSession(): void {
		this.setStoredProviderCredentials(undefined);
		this.setRemoteAccountEmail("");
		this.setRemoteAuthSession(false);
	}

	get settings(): Readonly<DriveSyncSettings> {
		return this.mutableSettings;
	}

	updateSettings(patch: Partial<DriveSyncSettings>): void {
		this.mutableSettings = {
			...this.mutableSettings,
			...patch,
		};
	}

	async saveSettings(): Promise<void> {
		const data = mergePluginData(await loadPluginData(this));
		data.settings = serializeSettings(this.mutableSettings);
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

	async loadSyncState() {
		if (this.runtime) {
			return await this.runtime.loadSyncState();
		}
		return await loadSyncStateUseCase();
	}

	async clearConflictMarker(path: string) {
		if (this.runtime) {
			return await this.runtime.clearConflictMarker(path);
		}
		return await clearConflictMarkerUseCase(path);
	}
}
