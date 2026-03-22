import { DEFAULT_SETTINGS } from "@contracts/plugin/default-settings";
import type {
	ObsidianDriveSyncPluginRuntimeApi,
	RemoteConnectionStatePatch,
	RemoteConnectionView,
	RemoteProviderOption,
} from "@contracts/plugin/plugin-api";
import type { DriveSyncSettings } from "@contracts/plugin/settings";
import type { LocalProvider } from "@contracts/provider/local-provider";
import {
	DEFAULT_LOCAL_PROVIDER_ID,
	DEFAULT_REMOTE_PROVIDER_ID,
	type RemoteProviderId,
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

	constructor(
		private readonly plugin: ObsidianDriveSyncPluginRuntimeApi<RegisteredRemoteProvider>,
	) {}

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

	listRemoteProviderOptions(): RemoteProviderOption[] {
		return this.remoteProviderRegistry.list().map((provider) => ({
			id: provider.id,
			label: provider.label,
		}));
	}

	getRemoteProvider(providerId?: RemoteProviderId): RegisteredRemoteProvider {
		return this.remoteProviderRegistry.get(providerId ?? this.getRemoteProviderId());
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

	getStoredRemoteCredentials():
		| RemoteProviderCredentialsOf<RegisteredRemoteProvider>
		| undefined {
		return this.mutableSettings.remoteProviderCredentials as
			| RemoteProviderCredentialsOf<RegisteredRemoteProvider>
			| undefined;
	}

	getRemoteConnectionView(): RemoteConnectionView {
		const provider = this.getRemoteProvider();
		return {
			providerId: this.getRemoteProviderId(),
			providerLabel: provider.label,
			scopeId: this.mutableSettings.remoteScopeId.trim(),
			scopePath: this.mutableSettings.remoteScopePath.trim(),
			accountEmail: this.mutableSettings.remoteAccountEmail,
			hasAuthSession: this.mutableSettings.remoteHasAuthSession,
			hasStoredCredentials: Boolean(this.getStoredRemoteCredentials()),
			isSessionValidated: provider.isSessionValidated(),
		};
	}

	updateRemoteConnectionState(patch: RemoteConnectionStatePatch<RegisteredRemoteProvider>): void {
		const nextPatch: Partial<DriveSyncSettings> = {};
		if ("scopeId" in patch) {
			nextPatch.remoteScopeId = patch.scopeId?.trim() ?? "";
		}
		if ("scopePath" in patch) {
			nextPatch.remoteScopePath = patch.scopePath?.trim() ?? "";
		}
		if ("credentials" in patch) {
			nextPatch.remoteProviderCredentials = patch.credentials;
		}
		if ("accountEmail" in patch) {
			nextPatch.remoteAccountEmail = patch.accountEmail?.trim() ?? "";
		}
		if ("hasAuthSession" in patch && typeof patch.hasAuthSession === "boolean") {
			nextPatch.remoteHasAuthSession = patch.hasAuthSession;
		}
		this.updateSettings(nextPatch);
	}

	clearStoredRemoteSession(): void {
		this.updateRemoteConnectionState({
			credentials: undefined,
			accountEmail: "",
			hasAuthSession: false,
		});
	}

	async saveSettings(): Promise<void> {
		const data = mergePluginData(await loadPluginData(this.plugin));
		data.settings = serializeSettings(this.mutableSettings);
		await savePluginData(this.plugin, data);
	}
}
