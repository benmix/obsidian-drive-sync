import type { App, Plugin } from "obsidian";

import type { LocalProvider } from "../provider/local-provider";
import type {
	RemoteProvider,
	RemoteProviderCredentials,
	RemoteProviderSession,
} from "../provider/remote-provider";
import type { SyncState } from "../sync/state";

import type { DriveSyncSettings } from "./settings";

export interface ObsidianDriveSyncPluginApi extends Plugin {
	readonly app: App;
	readonly settings: Readonly<DriveSyncSettings>;
	updateSettings(patch: Partial<DriveSyncSettings>): void;

	getRemoteProviderId(): string;
	listRemoteProviders(): RemoteProvider[];
	getRemoteProvider(): RemoteProvider;
	setRemoteProviderId(providerId: string): void;
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
	connectRemoteClient(): Promise<unknown>;
	runAutoSync(force?: boolean): Promise<void>;
	isSyncRunning(): boolean;
	handleAuthRecovered(scheduleSync?: boolean): void;
	getBuiltInExcludePatterns(): readonly string[];
	loadSyncState(): Promise<SyncState>;
	clearConflictMarker(path: string): Promise<boolean>;
}
