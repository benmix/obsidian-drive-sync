import type { DriveSyncSettings } from "@contracts/plugin/settings";
import type { LocalProvider } from "@contracts/provider/local-provider";
import type {
	AnyRemoteProvider,
	RemoteProvider,
	RemoteProviderClient,
	RemoteProviderCredentialsOf,
} from "@contracts/provider/remote-provider";
import type { SyncState } from "@contracts/sync/state";
import type { App, Plugin } from "obsidian";

export type RemoteConnectionState<TProvider extends AnyRemoteProvider = AnyRemoteProvider> = {
	providerId: string;
	provider: TProvider;
	scopeId: string;
	scopePath: string;
	credentials: RemoteProviderCredentialsOf<TProvider> | undefined;
	accountEmail: string;
	hasAuthSession: boolean;
};

export type RemoteConnectionStatePatch<TProvider extends AnyRemoteProvider = AnyRemoteProvider> = {
	scopeId?: string;
	scopePath?: string;
	credentials?: RemoteProviderCredentialsOf<TProvider> | undefined;
	accountEmail?: string;
	hasAuthSession?: boolean;
};

export interface ObsidianDriveSyncPluginApi<
	TProvider extends AnyRemoteProvider = RemoteProvider,
> extends Plugin {
	readonly app: App;
	readonly settings: Readonly<DriveSyncSettings>;
	updateSettings(patch: Partial<DriveSyncSettings>): void;

	listRemoteProviders(): TProvider[];
	setRemoteProviderId(providerId: string): void;
	getLocalProvider(): LocalProvider;
	getRemoteConnectionState(): RemoteConnectionState<TProvider>;
	updateRemoteConnectionState(patch: RemoteConnectionStatePatch<TProvider>): void;
	clearStoredRemoteSession(): void;

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
}
