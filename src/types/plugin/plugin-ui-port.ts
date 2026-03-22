import type {
	RemoteAuthView,
	RemoteConnectionView,
	RemoteFolderBrowser,
	RemoteProviderOption,
} from "@contracts/plugin/remote-connection-view";
import type { DriveSyncSettings } from "@contracts/plugin/settings";
import type { LocalProvider } from "@contracts/provider/local-provider";
import type { RemoteProviderId } from "@contracts/provider/provider-ids";
import type {
	AnyRemoteProvider,
	RemoteProvider,
	RemoteProviderClient,
	RemoteProviderLoginInput,
} from "@contracts/provider/remote-provider";
import type { SyncState } from "@contracts/sync/state";
import type { App, Plugin } from "obsidian";

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
