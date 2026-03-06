import type { App, EventRef } from "obsidian";
import type { LocalChange, LocalFileSystem, RemoteFileSystem } from "../filesystem/contracts";

export const DEFAULT_REMOTE_PROVIDER_ID = "proton-drive";
export const DEFAULT_LOCAL_PROVIDER_ID = "obsidian-local";

export type RemoteProviderId = string;
export type RemoteProviderCredentials = unknown;

export type RemoteProviderSession = {
	onTokenRefresh?: () => Promise<void>;
} & Record<string, unknown>;

export type RemoteProviderLoginInput = {
	username: string;
	password: string;
	twoFactorCode?: string;
	mailboxPassword?: string;
};

export type RemoteProviderLoginResult = {
	session: RemoteProviderSession;
	credentials: RemoteProviderCredentials;
	userEmail?: string;
};

export type RemoteScopeRoot = {
	id: string;
	label: string;
};

export type LocalProviderId = string;
export type LocalChangeWatcher = {
	start(): void;
	stop(): void;
};
export type LocalChangeHandler = (change: LocalChange) => void;

export interface LocalProvider {
	readonly id: LocalProviderId;
	readonly label: string;
	createLocalFileSystem(app: App): LocalFileSystem;
	createLocalWatcher(
		app: App,
		onChange: LocalChangeHandler,
		registerEvent: (eventRef: EventRef) => void,
		debounceMs?: number,
	): LocalChangeWatcher;
}

export interface RemoteProvider {
	readonly id: RemoteProviderId;
	readonly label: string;

	login(input: RemoteProviderLoginInput): Promise<RemoteProviderLoginResult>;
	restore(credentials: RemoteProviderCredentials): Promise<RemoteProviderSession>;
	getSession(): RemoteProviderSession | null;
	refreshToken(): Promise<RemoteProviderSession>;
	getReusableCredentials(): RemoteProviderCredentials;
	logout(): Promise<void>;
	isSessionValidated(): boolean;

	connect(session: RemoteProviderSession): Promise<unknown | null>;
	disconnect(): void;
	getRootScope(client: unknown): Promise<RemoteScopeRoot>;

	createRemoteFileSystem(client: unknown, scopeId: string): RemoteFileSystem;
	validateScope(client: unknown, scopeId: string): Promise<{ ok: boolean; message: string }>;
}
