import type { AuthSession } from "@contracts/provider/proton/auth-session";
import type { ReusableCredentials, Session } from "@contracts/provider/proton/auth-types";
import type { ProtonSession } from "@contracts/provider/proton/sdk-session";
import type { RemoteProvider, RemoteProviderLoginInput } from "@contracts/provider/remote-provider";
import type { ProtonDriveClient } from "@protontech/drive-sdk";

export type ProtonDriveConnectedClient = {
	sdk: ProtonDriveClient;
	getLatestEventId(eventScopeId: string): string | null;
	setLatestEventId(eventScopeId: string, eventId?: string): void;
};

export type ProtonDriveProvider = RemoteProvider<
	ProtonDriveConnectedClient,
	ProtonSession,
	ReusableCredentials
>;

export interface ProtonDriveAuthServiceContract {
	login(credentials: RemoteProviderLoginInput): Promise<AuthSession>;
	restore(credentials: ReusableCredentials): Promise<Session>;
	getSession(): Session | null;
	refreshToken(): Promise<Session>;
	getReusableCredentials(): ReusableCredentials;
	logout(): Promise<void>;
	isSessionValidated(): boolean;
}

export interface ProtonDriveServiceContract {
	connect(
		session: ProtonSession,
		getSession?: () => ProtonSession | null,
		onTokenRefresh?: () => Promise<void>,
	): Promise<ProtonDriveConnectedClient | null>;
	disconnect(): void;
}

export type ProtonDriveProviderInitOptions = {
	authService?: ProtonDriveAuthServiceContract;
	driveService?: ProtonDriveServiceContract;
};
