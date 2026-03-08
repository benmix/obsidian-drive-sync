import type { ReusableCredentials, Session } from "./auth-types";
import type { AuthSession } from "./auth-session";
import type { ProtonSession } from "./sdk-session";
import type { RemoteProviderLoginInput } from "../remote-provider";

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
	connect(session: ProtonSession, onTokenRefresh?: () => Promise<void>): Promise<unknown | null>;
	disconnect(): void;
}

export type ProtonDriveProviderInitOptions = {
	authService?: ProtonDriveAuthServiceContract;
	driveService?: ProtonDriveServiceContract;
};
