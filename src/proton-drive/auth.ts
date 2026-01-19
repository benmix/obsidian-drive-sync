import type { Session, ApiError, ReusableCredentials } from "./proton-auth/types";
import { ProtonAuth as ProtonAuthClient } from "./proton-auth/core";
import type { ProtonAuth } from "./proton-auth/core";
import { createProtonHttpClient } from "./proton-auth/sdk-helpers";
import { logger } from "./logger";

export type AuthSession = {
	session: Session;
	credentials: ReusableCredentials;
	userEmail?: string;
};

export class ProtonDriveAuthService {
	private authClient: ProtonAuth | null = null;
	private validated = false;

	async login(credentials: {
		username: string;
		password: string;
		twoFactorCode?: string;
		mailboxPassword?: string;
	}): Promise<AuthSession> {
		const client = this.getAuthClient();
		logger.info("Starting Proton authentication");
		try {
			await client.login(
				credentials.username,
				credentials.password,
				credentials.twoFactorCode ?? null,
			);
		} catch (error) {
			const apiError = error as ApiError;
			if (apiError.requires2FA) {
				logger.warn("Two-factor authentication required");
				throw new Error("Two-factor authentication is required.");
			}
			if (apiError.requiresMailboxPassword) {
				if (!credentials.mailboxPassword) {
					logger.warn("Mailbox password required for two-password account");
					throw new Error("Mailbox password is required for this account.");
				}
				await client.submitMailboxPassword(credentials.mailboxPassword);
			} else {
				logger.warn("Authentication failed");
				throw error;
			}
		}

		const session = client.getSession();
		if (!session) {
			logger.warn("Authentication completed without a session");
			throw new Error("Login failed. No session returned.");
		}
		await this.validateSessionWithHttpClient(session);
		this.validated = true;
		logger.info("Authentication successful");
		const credentialsPayload = client.getReusableCredentials();
		return {
			session,
			credentials: credentialsPayload,
			userEmail: session.user?.Name ?? credentials.username,
		};
	}

	async submitTwoFactor(code: string): Promise<AuthSession> {
		const client = this.getAuthClient();
		logger.info("Submitting two-factor code");
		await client.submit2FA(code);
		const session = client.getSession();
		if (!session) {
			logger.warn("Two-factor flow completed without a session");
			throw new Error("2FA failed. No session returned.");
		}
		await this.validateSessionWithHttpClient(session);
		this.validated = true;
		logger.info("Two-factor authentication successful");
		const credentials = client.getReusableCredentials();
		return { session, credentials, userEmail: session.user?.Name };
	}

	async restore(credentials: ReusableCredentials): Promise<Session> {
		const client = this.getAuthClient();
		logger.info("Restoring Proton session from stored credentials");
		const session = await client.restoreSession(credentials);
		await this.validateSessionWithHttpClient(session);
		this.validated = true;
		logger.info("Session restored");
		return session;
	}

	getSession(): Session | null {
		return this.authClient?.getSession() ?? null;
	}

	async refreshToken(): Promise<Session> {
		const client = this.getAuthClient();
		logger.info("Refreshing Proton session");
		const session = await client.refreshTokenWithForkRecovery();
		await this.validateSessionWithHttpClient(session);
		this.validated = true;
		logger.info("Session refreshed");
		return session;
	}

	getReusableCredentials(): ReusableCredentials {
		const client = this.getAuthClient();
		return client.getReusableCredentials();
	}

	async logout(): Promise<void> {
		if (!this.authClient) {
			return;
		}
		logger.info("Signing out of Proton Drive");
		await this.authClient.logout();
		this.authClient = null;
		this.validated = false;
	}

	isSessionValidated(): boolean {
		return this.validated;
	}

	private getAuthClient(): ProtonAuth {
		if (this.authClient) {
			return this.authClient;
		}
		this.authClient = new ProtonAuthClient();
		return this.authClient;
	}

	private async validateSessionWithHttpClient(session: Session): Promise<void> {
		const httpClient = createProtonHttpClient(session, async () => {
			if (this.authClient) {
				await this.authClient.refreshTokenWithForkRecovery();
			}
		});
		const response = await httpClient.fetchJson({
			url: "core/v4/users",
			method: "GET",
			headers: new Headers(),
			timeoutMs: 15000,
		});
		if (!response.ok) {
			throw new Error(`Session validation failed (${response.status})`);
		}
	}
}
