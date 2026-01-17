import type { Session, ApiError, ProtonAuth, ReusableCredentials } from "./proton-auth";
import { ProtonAuth as ProtonAuthClient } from "./proton-auth";

export type AuthSession = {
	session: Session;
	credentials: ReusableCredentials;
	userEmail?: string;
};

export class ProtonDriveAuthService {
	private authClient: ProtonAuth | null = null;

	async login(credentials: {
		username: string;
		password: string;
		twoFactorCode?: string;
		mailboxPassword?: string;
	}): Promise<AuthSession> {
		const client = this.getAuthClient();
		try {
			await client.login(
				credentials.username,
				credentials.password,
				credentials.twoFactorCode ?? null,
			);
		} catch (error) {
			const apiError = error as ApiError;
			if (apiError.requires2FA) {
				throw new Error("Two-factor authentication is required.");
			}
			if (apiError.requiresMailboxPassword) {
				if (!credentials.mailboxPassword) {
					throw new Error("Mailbox password is required for this account.");
				}
				await client.submitMailboxPassword(credentials.mailboxPassword);
			} else {
				throw error;
			}
		}

		const session = client.getSession();
		if (!session) {
			throw new Error("Login failed. No session returned.");
		}
		const credentialsPayload = client.getReusableCredentials();
		return {
			session,
			credentials: credentialsPayload,
			userEmail: session.user?.Name ?? credentials.username,
		};
	}

	async submitTwoFactor(code: string): Promise<AuthSession> {
		const client = this.getAuthClient();
		await client.submit2FA(code);
		const session = client.getSession();
		if (!session) {
			throw new Error("2FA failed. No session returned.");
		}
		const credentials = client.getReusableCredentials();
		return { session, credentials, userEmail: session.user?.Name };
	}

	async restore(credentials: ReusableCredentials): Promise<Session> {
		const client = this.getAuthClient();
		return await client.restoreSession(credentials);
	}

	getSession(): Session | null {
		return this.authClient?.getSession() ?? null;
	}

	async refreshToken(): Promise<Session> {
		const client = this.getAuthClient();
		return await client.refreshTokenWithForkRecovery();
	}

	getReusableCredentials(): ReusableCredentials {
		const client = this.getAuthClient();
		return client.getReusableCredentials();
	}

	async logout(): Promise<void> {
		if (!this.authClient) {
			return;
		}
		await this.authClient.logout();
		this.authClient = null;
	}

	private getAuthClient(): ProtonAuth {
		if (this.authClient) {
			return this.authClient;
		}
		this.authClient = new ProtonAuthClient();
		return this.authClient;
	}
}
