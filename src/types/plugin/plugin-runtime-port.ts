import type { ObsidianDriveSyncPluginApi } from "@contracts/plugin/plugin-ui-port";
import type { RemoteProviderId } from "@contracts/provider/provider-ids";
import type {
	AnyRemoteProvider,
	RemoteProvider,
	RemoteProviderClient,
	RemoteProviderCredentialsOf,
	RemoteProviderSessionOf,
} from "@contracts/provider/remote-provider";

export type RemoteConnectionStatePatch<TProvider extends AnyRemoteProvider = AnyRemoteProvider> = {
	scopeId?: string;
	scopePath?: string;
	credentials?: RemoteProviderCredentialsOf<TProvider> | undefined;
	accountEmail?: string;
	hasAuthSession?: boolean;
};

export type BoundRemoteProvider<TProvider extends AnyRemoteProvider> = RemoteProvider<
	RemoteProviderClient<TProvider>,
	RemoteProviderSessionOf<TProvider>,
	RemoteProviderCredentialsOf<TProvider>
>;

export interface ObsidianDriveSyncPluginRuntimeApi<
	TProvider extends AnyRemoteProvider = RemoteProvider,
> extends ObsidianDriveSyncPluginApi<TProvider> {
	listRemoteProviders(): BoundRemoteProvider<TProvider>[];
	setRemoteProviderId(providerId: RemoteProviderId): void;
	getRemoteProvider(providerId?: RemoteProviderId): BoundRemoteProvider<TProvider>;
	getStoredRemoteCredentials(): RemoteProviderCredentialsOf<TProvider> | undefined;
	updateRemoteConnectionState(patch: RemoteConnectionStatePatch<TProvider>): void;
	clearStoredRemoteSession(): void;
}
