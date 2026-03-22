import type { DriveSyncSettings } from "@contracts/plugin/settings";
import type { LocalProvider } from "@contracts/provider/local-provider";
import type { RemoteProviderId } from "@contracts/provider/provider-ids";
import type {
	AnyRemoteProvider,
	RemoteProvider,
	RemoteProviderClient,
	RemoteProviderCredentialsOf,
	RemoteProviderLoginInput,
	RemoteProviderSessionOf,
} from "@contracts/provider/remote-provider";
import type { SyncState } from "@contracts/sync/state";
import type { App, Plugin } from "obsidian";

export type RemoteProviderOption = {
	id: RemoteProviderId;
	label: string;
};

export type RemoteConnectionView = {
	providerId: RemoteProviderId;
	providerLabel: string;
	scopeId: string;
	scopePath: string;
	accountEmail: string;
	hasAuthSession: boolean;
	hasStoredCredentials: boolean;
	isSessionValidated: boolean;
};

export type RemoteAuthStatus =
	| "signed_out"
	| "needs_attention"
	| "pending_validation"
	| "signed_in"
	| "paused";

export type RemoteAuthView = {
	status: RemoteAuthStatus;
	message?: string;
	providerId: RemoteProviderId;
	providerLabel: string;
	accountEmail: string;
	canConnect: boolean;
	canBrowseRemoteFolder: boolean;
};

export type RemoteConnectionStatePatch<TProvider extends AnyRemoteProvider = AnyRemoteProvider> = {
	scopeId?: string;
	scopePath?: string;
	credentials?: RemoteProviderCredentialsOf<TProvider> | undefined;
	accountEmail?: string;
	hasAuthSession?: boolean;
};

export type RemoteFolderEntry = {
	id: string;
	name: string;
	path?: string;
	type: "folder" | "file";
};

export type RemoteFolderBrowser = {
	listFolderEntries(): Promise<RemoteFolderEntry[]>;
	listChildFolderEntries?(): Promise<RemoteFolderEntry[]>;
	ensureFolder?(path: string): Promise<{ id?: string }>;
};

export type BoundRemoteProvider<TProvider extends AnyRemoteProvider> = RemoteProvider<
	RemoteProviderClient<TProvider>,
	RemoteProviderSessionOf<TProvider>,
	RemoteProviderCredentialsOf<TProvider>
>;

export interface ObsidianDriveSyncPluginApi<
	TProvider extends AnyRemoteProvider = RemoteProvider,
> extends Plugin {
	readonly app: App;
	readonly settings: Readonly<DriveSyncSettings>;
	updateSettings(patch: Partial<DriveSyncSettings>): void;

	listRemoteProviderOptions(): RemoteProviderOption[];
	getLocalProvider(): LocalProvider;
	getRemoteConnectionView(): RemoteConnectionView;
	getRemoteAuthView(): RemoteAuthView;

	saveSettings(): Promise<void>;

	refreshAutoSync(): void;
	pauseAutoSync(): void;
	resumeAutoSync(): void;
	isAutoSyncPaused(): boolean;

	isAuthPaused(): boolean;
	getLastAuthError(): string | undefined;
	connectRemoteClient(): Promise<RemoteProviderClient<TProvider>>;
	runAutoSync(force?: boolean): Promise<void>;
	isSyncRunning(): boolean;
	handleAuthRecovered(scheduleSync?: boolean): void;
	getBuiltInExcludePatterns(): readonly string[];
	loadSyncState(): Promise<SyncState>;
	clearConflictMarker(path: string): Promise<boolean>;
	setRemoteScope(scopeId: string, scopePath: string): Promise<void>;
	loginRemote(
		providerId: RemoteProviderId,
		input: RemoteProviderLoginInput,
	): Promise<{ providerLabel: string; accountEmail: string }>;
	logoutRemote(): Promise<{ providerLabel: string }>;
	resetRemoteConnection(): { providerLabel: string };
	validateRemoteScope(scopeId: string): Promise<{ ok: boolean; message: string }>;
	openRemoteScopeFileSystem(): Promise<{
		providerLabel: string;
		rootScope: { id: string; label: string };
		browser: RemoteFolderBrowser;
	}>;
	refreshRemoteScopeFileSystem(): Promise<{
		providerLabel: string;
		rootScope: { id: string; label: string };
		browser: RemoteFolderBrowser;
	}>;
}

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
