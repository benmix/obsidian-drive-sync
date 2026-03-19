import type { DriveSyncSettings } from "@contracts/plugin/settings";
import type { LocalProvider } from "@contracts/provider/local-provider";
import type {
	AnyRemoteProvider,
	RemoteProvider,
	RemoteProviderClient,
	RemoteProviderCredentialsOf,
	RemoteProviderSessionOf,
} from "@contracts/provider/remote-provider";
import type { SyncState } from "@contracts/sync/state";
import type { App, Plugin } from "obsidian";

export interface ObsidianDriveSyncPluginApi<
	TProvider extends AnyRemoteProvider = RemoteProvider,
> extends Plugin {
	readonly app: App;
	readonly settings: Readonly<DriveSyncSettings>;
	updateSettings(patch: Partial<DriveSyncSettings>): void;

	getRemoteProviderId(): string;
	listRemoteProviders(): TProvider[];
	getRemoteProvider(): TProvider;
	setRemoteProviderId(providerId: string): void;
	getLocalProviderId(): string;
	getLocalProvider(): LocalProvider;
	getRemoteScopeId(): string;
	getRemoteScopePath(): string;
	setRemoteScope(scopeId: string, scopePath: string): void;

	getStoredProviderCredentials(): RemoteProviderCredentialsOf<TProvider> | undefined;
	setStoredProviderCredentials(
		credentials: RemoteProviderCredentialsOf<TProvider> | undefined,
	): void;

	getRemoteAccountEmail(): string;
	setRemoteAccountEmail(email: string): void;

	hasRemoteAuthSession(): boolean;
	setRemoteAuthSession(hasAuthSession: boolean): void;
	clearStoredRemoteSession(): void;

	saveSettings(): Promise<void>;

	refreshAutoSync(): void;
	pauseAutoSync(): void;
	resumeAutoSync(): void;
	isAutoSyncPaused(): boolean;

	isAuthPaused(): boolean;
	getLastAuthError(): string | undefined;
	buildActiveRemoteSession(): Promise<RemoteProviderSessionOf<TProvider> | null>;
	connectRemoteClient(): Promise<RemoteProviderClient<TProvider>>;
	runAutoSync(force?: boolean): Promise<void>;
	isSyncRunning(): boolean;
	handleAuthRecovered(scheduleSync?: boolean): void;
	getBuiltInExcludePatterns(): readonly string[];
	loadSyncState(): Promise<SyncState>;
	clearConflictMarker(path: string): Promise<boolean>;
}
