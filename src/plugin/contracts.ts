import type { App, Plugin } from "obsidian";
import type {
	LocalProvider,
	RemoteProvider,
	RemoteProviderCredentials,
	RemoteProviderSession,
} from "../provider/contracts";
import type { DriveSyncSettings } from "../contracts/settings";
import type { SyncState } from "../sync/state/index-store";

export interface ObsidianDriveSyncPluginApi extends Plugin {
	readonly app: App;
	settings: DriveSyncSettings;

	getRemoteProviderId(): string;
	getRemoteProvider(): RemoteProvider;
	getLocalProviderId(): string;
	getLocalProvider(): LocalProvider;
	getRemoteScopeId(): string;
	getRemoteScopePath(): string;
	setRemoteScope(scopeId: string, scopePath: string): void;

	getStoredProviderCredentials(): RemoteProviderCredentials | undefined;
	setStoredProviderCredentials(credentials: RemoteProviderCredentials | undefined): void;

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
	buildActiveRemoteSession(): Promise<RemoteProviderSession | null>;
	connectRemoteClient(): Promise<unknown | null>;
	runAutoSync(force?: boolean): Promise<void>;
	isSyncRunning(): boolean;
	handleAuthRecovered(scheduleSync?: boolean): void;
	loadSyncState(): Promise<SyncState>;
	clearConflictMarker(path: string): Promise<boolean>;
}
