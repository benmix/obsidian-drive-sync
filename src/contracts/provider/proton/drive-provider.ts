import type { ProtonDriveClient } from "@protontech/drive-sdk";

import type { RemoteProvider, RemoteProviderLoginInput } from "../remote-provider";

import type { AuthSession } from "./auth-session";
import type { ReusableCredentials, Session } from "./auth-types";
import type { ProtonSession } from "./sdk-session";

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
