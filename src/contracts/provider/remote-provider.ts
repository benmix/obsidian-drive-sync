import type { RemoteFileSystem } from "../filesystem/file-system";

import type { RemoteProviderId } from "./provider-ids";

export type RemoteProviderCredentials = unknown;
export type RemoteProviderSession = object;

export type RemoteProviderConnectOptions = {
	onTokenRefresh?: () => Promise<void>;
};

export type RemoteProviderLoginInput = {
	username: string;
	password: string;
	twoFactorCode?: string;
	mailboxPassword?: string;
};

export type RemoteProviderLoginResult<
	TSession extends RemoteProviderSession = RemoteProviderSession,
	TCredentials = RemoteProviderCredentials,
> = {
	session: TSession;
	credentials: TCredentials;
	userEmail?: string;
};

export type RemoteScopeRoot = {
	id: string;
	label: string;
};

export interface RemoteProvider<
	TClient = unknown,
	TSession extends RemoteProviderSession = RemoteProviderSession,
	TCredentials = RemoteProviderCredentials,
> {
	readonly id: RemoteProviderId;
	readonly label: string;

	login(
		input: RemoteProviderLoginInput,
	): Promise<RemoteProviderLoginResult<TSession, TCredentials>>;
	restore(credentials: TCredentials): Promise<TSession>;
	getSession(): TSession | null;
	refreshToken(): Promise<TSession>;
	getReusableCredentials(): TCredentials;
	logout(): Promise<void>;
	isSessionValidated(): boolean;

	connect(session: TSession, options?: RemoteProviderConnectOptions): Promise<TClient | null>;
	disconnect(): void;
	getRootScope(client: TClient): Promise<RemoteScopeRoot>;

	createRemoteFileSystem(client: TClient, scopeId: string): RemoteFileSystem;
	validateScope(client: TClient, scopeId: string): Promise<{ ok: boolean; message: string }>;
}

export type AnyRemoteProvider = RemoteProvider<
	unknown,
	RemoteProviderSession,
	RemoteProviderCredentials
>;

export type RemoteProviderClient<TProvider extends AnyRemoteProvider> =
	TProvider extends RemoteProvider<infer TClient, any, any> ? TClient : never;

export type RemoteProviderSessionOf<TProvider extends AnyRemoteProvider> =
	TProvider extends RemoteProvider<unknown, infer TSession, any> ? TSession : never;

export type RemoteProviderCredentialsOf<TProvider extends AnyRemoteProvider> =
	TProvider extends RemoteProvider<unknown, any, infer TCredentials> ? TCredentials : never;
