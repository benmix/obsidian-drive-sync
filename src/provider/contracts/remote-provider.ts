import type { RemoteFileSystem } from "../../filesystem";
import type { RemoteProviderId } from "./provider-ids";

export type RemoteProviderCredentials = unknown;
export type RemoteProviderSession = Record<string, unknown>;

export type RemoteProviderConnectOptions = {
	onTokenRefresh?: () => Promise<void>;
};

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

	connect(
		session: RemoteProviderSession,
		options?: RemoteProviderConnectOptions,
	): Promise<unknown | null>;
	disconnect(): void;
	getRootScope(client: unknown): Promise<RemoteScopeRoot>;

	createRemoteFileSystem(client: unknown, scopeId: string): RemoteFileSystem;
	validateScope(client: unknown, scopeId: string): Promise<{ ok: boolean; message: string }>;
}
