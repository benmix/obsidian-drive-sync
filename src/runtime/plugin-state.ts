import { DEFAULT_SETTINGS } from "@contracts/plugin/default-settings";
import type { ObsidianDriveSyncPluginApi } from "@contracts/plugin/plugin-api";
import type { DriveSyncSettings } from "@contracts/plugin/settings";
import type { LocalProvider } from "@contracts/provider/local-provider";
import {
	DEFAULT_LOCAL_PROVIDER_ID,
	DEFAULT_REMOTE_PROVIDER_ID,
} from "@contracts/provider/provider-ids";
import type { RemoteProviderCredentialsOf } from "@contracts/provider/remote-provider";
import {
	loadPluginData,
	mergePluginData,
	savePluginData,
	serializeSettings,
} from "@data/plugin-data";
import {
	createLocalProviderRegistry,
	createRemoteProviderRegistry,
	type RegisteredRemoteProvider,
} from "@provider/default-registry";
import { LocalProviderRegistry, RemoteProviderRegistry } from "@provider/registry";

export class PluginState {
	private mutableSettings: DriveSyncSettings = { ...DEFAULT_SETTINGS };
	private localProviderRegistry: LocalProviderRegistry = new LocalProviderRegistry();
	private remoteProviderRegistry: RemoteProviderRegistry<RegisteredRemoteProvider> =
		new RemoteProviderRegistry<RegisteredRemoteProvider>();

	constructor(private readonly plugin: ObsidianDriveSyncPluginApi<RegisteredRemoteProvider>) {}

	async initializeFromStorage(): Promise<void> {
		const data = await loadPluginData(this.plugin);
		this.mutableSettings = data.settings;
		this.localProviderRegistry = createLocalProviderRegistry(this.getLocalProviderId());
		this.remoteProviderRegistry = createRemoteProviderRegistry();
		this.remoteProviderRegistry.get(this.getRemoteProviderId());
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

	getRemoteProviderId(): string {
		const providerId = this.mutableSettings.remoteProviderId.trim();
		return providerId || DEFAULT_REMOTE_PROVIDER_ID;
	}

	listRemoteProviders(): RegisteredRemoteProvider[] {
		return this.remoteProviderRegistry.list();
	}

	getRemoteProvider(): RegisteredRemoteProvider {
		return this.remoteProviderRegistry.get(this.getRemoteProviderId());
	}

	setRemoteProviderId(providerId: string): void {
		const nextProviderId = providerId.trim() || DEFAULT_REMOTE_PROVIDER_ID;
		if (nextProviderId === this.getRemoteProviderId()) {
			return;
		}
		const nextRegistry = createRemoteProviderRegistry();
		nextRegistry.get(nextProviderId);
		this.remoteProviderRegistry = nextRegistry;
		this.mutableSettings = {
			...this.mutableSettings,
			remoteProviderId: nextProviderId,
			remoteScopeId: "",
			remoteScopePath: "",
			remoteProviderCredentials: undefined,
			remoteAccountEmail: "",
			remoteHasAuthSession: false,
		};
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

	getStoredProviderCredentials():
		| RemoteProviderCredentialsOf<RegisteredRemoteProvider>
		| undefined {
		return this.mutableSettings.remoteProviderCredentials as
			| RemoteProviderCredentialsOf<RegisteredRemoteProvider>
			| undefined;
	}

	setStoredProviderCredentials(
		credentials: RemoteProviderCredentialsOf<RegisteredRemoteProvider> | undefined,
	): void {
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

	async saveSettings(): Promise<void> {
		const data = mergePluginData(await loadPluginData(this.plugin));
		data.settings = serializeSettings(this.mutableSettings);
		await savePluginData(this.plugin, data);
	}
}
