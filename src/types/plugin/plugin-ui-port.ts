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

export interface PluginAppPort extends Plugin {
	readonly app: App;
}

export interface PluginSettingsReadPort {
	readonly settings: Readonly<DriveSyncSettings>;
}

export interface PluginSettingsWritePort {
	updateSettings(patch: Partial<DriveSyncSettings>): void;
	saveSettings(): Promise<void>;
}

export interface PluginRemoteViewPort {
	listRemoteProviderOptions(): RemoteProviderOption[];
	getRemoteConnectionView(): RemoteConnectionView;
	getRemoteAuthView(): RemoteAuthView;
}

export interface PluginLocalProviderPort {
	getLocalProvider(): LocalProvider;
}

export interface PluginAutoSyncPort {
	refreshAutoSync(): void;
	pauseAutoSync(): void;
	resumeAutoSync(): void;
	isAutoSyncPaused(): boolean;
}

export interface PluginSyncStatusPort {
	isSyncRunning(): boolean;
}

export interface PluginSyncActionPort<TProvider extends AnyRemoteProvider = RemoteProvider> {
	connectRemoteClient(): Promise<RemoteProviderClient<TProvider>>;
	runAutoSync(force?: boolean): Promise<void>;
	handleAuthRecovered(scheduleSync?: boolean): void;
}

export interface PluginDiagnosticsPort {
	getBuiltInExcludePatterns(): readonly string[];
	loadSyncState(): Promise<SyncState>;
	clearConflictMarker(path: string): Promise<boolean>;
}

export interface PluginRemoteScopePort {
	setRemoteScope(scopeId: string, scopePath: string): Promise<void>;
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

export interface PluginAuthActionPort {
	loginRemote(
		providerId: RemoteProviderId,
		input: RemoteProviderLoginInput,
	): Promise<{ providerLabel: string; accountEmail: string }>;
	logoutRemote(): Promise<{ providerLabel: string }>;
	resetRemoteConnection(): { providerLabel: string };
}

export interface ObsidianDriveSyncPluginApi<TProvider extends AnyRemoteProvider = RemoteProvider>
	extends
		PluginAppPort,
		PluginSettingsReadPort,
		PluginSettingsWritePort,
		PluginRemoteViewPort,
		PluginLocalProviderPort,
		PluginAutoSyncPort,
		PluginSyncStatusPort,
		PluginSyncActionPort<TProvider>,
		PluginDiagnosticsPort,
		PluginRemoteScopePort,
		PluginAuthActionPort {}

export type PluginSettingsPanelPort = PluginAppPort &
	PluginSettingsReadPort &
	PluginSettingsWritePort &
	PluginRemoteViewPort &
	PluginAutoSyncPort &
	PluginDiagnosticsPort &
	PluginRemoteScopePort &
	PluginAuthActionPort;

export type PluginStatusModalPort = PluginSettingsReadPort &
	PluginAutoSyncPort &
	PluginSyncStatusPort &
	PluginDiagnosticsPort &
	PluginRemoteViewPort;

export type PluginConflictModalPort = PluginSettingsReadPort &
	PluginAutoSyncPort &
	PluginDiagnosticsPort;

export type PluginRemoteLoginPort = PluginAppPort & PluginRemoteViewPort & PluginAuthActionPort;

export type PluginRemoteFolderPort = PluginAppPort & PluginRemoteViewPort & PluginRemoteScopePort;

export type PluginPreSyncModalPort = PluginAppPort;
