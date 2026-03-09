import { Plugin } from "obsidian";

import { registerCommands } from "./commands";
import type { ObsidianDriveSyncPluginApi } from "./contracts/plugin/plugin-api";
import type { DriveSyncSettings } from "./contracts/plugin/settings";
import type { LocalProvider } from "./contracts/provider/local-provider";
import type {
	RemoteProvider,
	RemoteProviderCredentials,
	RemoteProviderSession,
} from "./contracts/provider/remote-provider";
import { PluginRuntime } from "./runtime/plugin-runtime";
import { PluginState } from "./runtime/plugin-state";

export default class ObsidianDriveSyncPlugin
	extends Plugin
	implements ObsidianDriveSyncPluginApi
{
	private state: PluginState | null = null;
	private runtime: PluginRuntime | null = null;

	async onload(): Promise<void> {
		const migrated = await this.getState().initializeFromStorage();
		if (migrated) {
			await this.saveSettings();
		}

		this.runtime = this.getRuntime();
		await this.runtime.restoreSession();

		registerCommands(this);
		this.refreshAutoSync();
	}

	onunload(): void {
		this.runtime?.teardown();
	}

	getRemoteProviderId(): string {
		return this.getState().getRemoteProviderId();
	}

	getRemoteProvider(): RemoteProvider {
		return this.getState().getRemoteProvider();
	}

	getLocalProviderId(): string {
		return this.getState().getLocalProviderId();
	}

	getLocalProvider(): LocalProvider {
		return this.getState().getLocalProvider();
	}

	getRemoteScopeId(): string {
		return this.getState().getRemoteScopeId();
	}

	getRemoteScopePath(): string {
		return this.getState().getRemoteScopePath();
	}

	setRemoteScope(scopeId: string, scopePath: string): void {
		this.getState().setRemoteScope(scopeId, scopePath);
	}

	getStoredProviderCredentials(): RemoteProviderCredentials | undefined {
		return this.getState().getStoredProviderCredentials();
	}

	setStoredProviderCredentials(
		credentials: RemoteProviderCredentials | undefined,
	): void {
		this.getState().setStoredProviderCredentials(credentials);
	}

	getRemoteAccountEmail(): string {
		return this.getState().getRemoteAccountEmail();
	}

	setRemoteAccountEmail(email: string): void {
		this.getState().setRemoteAccountEmail(email);
	}

	hasRemoteAuthSession(): boolean {
		return this.getState().hasRemoteAuthSession();
	}

	setRemoteAuthSession(hasAuthSession: boolean): void {
		this.getState().setRemoteAuthSession(hasAuthSession);
	}

	clearStoredRemoteSession(): void {
		this.getState().clearStoredRemoteSession();
	}

	get settings(): Readonly<DriveSyncSettings> {
		return this.getState().settings;
	}

	updateSettings(patch: Partial<DriveSyncSettings>): void {
		this.getState().updateSettings(patch);
	}

	async saveSettings(): Promise<void> {
		await this.getState().saveSettings();
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

	getBuiltInExcludePatterns(): readonly string[] {
		return this.getRuntime().getBuiltInExcludePatterns();
	}

	async loadSyncState() {
		return await this.getRuntime().loadSyncState();
	}

	async clearConflictMarker(path: string) {
		return await this.getRuntime().clearConflictMarker(path);
	}

	private getRuntime(): PluginRuntime {
		if (!this.runtime) {
			this.runtime = new PluginRuntime(this);
		}
		return this.runtime;
	}

	private getState(): PluginState {
		if (!this.state) {
			this.state = new PluginState(this);
		}
		return this.state;
	}
}
