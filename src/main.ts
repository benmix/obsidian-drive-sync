import { registerCommands } from "@commands";
import type {
	ObsidianDriveSyncPluginApi,
	RemoteConnectionState,
	RemoteConnectionStatePatch,
} from "@contracts/plugin/plugin-api";
import type { DriveSyncSettings } from "@contracts/plugin/settings";
import type { LocalProvider } from "@contracts/provider/local-provider";
import type { RemoteProviderClient } from "@contracts/provider/remote-provider";
import { createDriveSyncError } from "@errors";
import type { RegisteredRemoteProvider } from "@provider/default-registry";
import { PluginRuntime } from "@runtime/plugin-runtime";
import { PluginState } from "@runtime/plugin-state";
import { Plugin } from "obsidian";

export default class ObsidianDriveSyncPlugin
	extends Plugin
	implements ObsidianDriveSyncPluginApi<RegisteredRemoteProvider>
{
	private state: PluginState | null = null;
	private runtime: PluginRuntime<RegisteredRemoteProvider> | null = null;

	async onload(): Promise<void> {
		await this.getState().initializeFromStorage();

		this.runtime = this.getRuntime();
		await this.runtime.restoreSession();

		registerCommands(this);
		this.refreshAutoSync();
	}

	onunload(): void {
		this.runtime?.teardown();
	}

	listRemoteProviders(): RegisteredRemoteProvider[] {
		return this.getState().listRemoteProviders();
	}

	setRemoteProviderId(providerId: string): void {
		this.getState().setRemoteProviderId(providerId);
	}

	getLocalProvider(): LocalProvider {
		return this.getState().getLocalProvider();
	}

	getRemoteConnectionState(): RemoteConnectionState<RegisteredRemoteProvider> {
		return this.getState().getRemoteConnectionState();
	}

	updateRemoteConnectionState(patch: RemoteConnectionStatePatch<RegisteredRemoteProvider>): void {
		this.getState().updateRemoteConnectionState(patch);
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

	async connectRemoteClient(): Promise<RemoteProviderClient<RegisteredRemoteProvider>> {
		if (!this.runtime) {
			throw createDriveSyncError("PROVIDER_CONNECT_FAILED", {
				category: "provider",
				userMessage: "Unable to connect to the remote provider.",
				userMessageKey: "error.provider.unableToConnect",
			});
		}
		return await this.runtime.connectRemoteClient();
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

	private getRuntime(): PluginRuntime<RegisteredRemoteProvider> {
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
