import { registerCommands } from "@commands";
import type { ObsidianDriveSyncPluginApi } from "@contracts/plugin/plugin-api";
import type { DriveSyncSettings } from "@contracts/plugin/settings";
import type { LocalProvider } from "@contracts/provider/local-provider";
import type {
	RemoteProviderClient,
	RemoteProviderCredentialsOf,
	RemoteProviderSessionOf,
} from "@contracts/provider/remote-provider";
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

	getRemoteProviderId(): string {
		return this.getState().getRemoteProviderId();
	}

	listRemoteProviders(): RegisteredRemoteProvider[] {
		return this.getState().listRemoteProviders();
	}

	getRemoteProvider(): RegisteredRemoteProvider {
		return this.getState().getRemoteProvider();
	}

	setRemoteProviderId(providerId: string): void {
		this.getState().setRemoteProviderId(providerId);
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

	getStoredProviderCredentials():
		| RemoteProviderCredentialsOf<RegisteredRemoteProvider>
		| undefined {
		return this.getState().getStoredProviderCredentials();
	}

	setStoredProviderCredentials(
		credentials: RemoteProviderCredentialsOf<RegisteredRemoteProvider> | undefined,
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

	async buildActiveRemoteSession(): Promise<RemoteProviderSessionOf<RegisteredRemoteProvider> | null> {
		return (await this.runtime?.buildActiveRemoteSession()) ?? null;
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
