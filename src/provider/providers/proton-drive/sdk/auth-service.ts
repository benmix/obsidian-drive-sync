import type { AuthSession } from "@contracts/provider/proton/auth-session";
import { INVALID_REFRESH_TOKEN_CODE } from "@contracts/provider/proton/auth-types";
import type { ApiError, ReusableCredentials, Session } from "@contracts/provider/proton/auth-types";
import { createDriveSyncError, normalizeUnknownDriveSyncError } from "@errors";
import { createProtonHttpClient } from "@provider/providers/proton-drive/sdk/auth-adapters";
import type { ProtonAuth } from "@provider/providers/proton-drive/sdk/auth-client";
import { ProtonAuth as ProtonAuthClient } from "@provider/providers/proton-drive/sdk/auth-client";
import { isProtonAuthError } from "@provider/providers/proton-drive/sdk/auth-errors";
import { logger } from "@provider/providers/proton-drive/sdk/logger";

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
				throw createDriveSyncError("AUTH_2FA_REQUIRED", {
					category: "auth",
					userMessage: "Two-factor authentication is required.",
					cause: error,
				});
			}
			if (apiError.requiresMailboxPassword) {
				if (!credentials.mailboxPassword) {
					logger.warn("Mailbox password required for two-password account");
					throw createDriveSyncError("AUTH_MAILBOX_PASSWORD_REQUIRED", {
						category: "auth",
						userMessage: "Mailbox password is required for this account.",
						cause: error,
					});
				}
				try {
					await client.submitMailboxPassword(credentials.mailboxPassword);
				} catch (mailboxError) {
					throw normalizeAuthError(mailboxError, {
						userMessage: "Authentication failed. Check your credentials and try again.",
					});
				}
			} else {
				logger.warn("Authentication failed");
				throw normalizeAuthError(error, {
					userMessage: "Authentication failed. Check your credentials and try again.",
				});
			}
		}

		const session = client.getSession();
		if (!session) {
			logger.warn("Authentication completed without a session");
			throw createDriveSyncError("AUTH_REAUTH_REQUIRED", {
				category: "auth",
				userMessage: "Authentication required. Sign in again to continue.",
				debugMessage: "Login failed. No session returned.",
			});
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
		try {
			await client.submit2FA(code);
		} catch (error) {
			throw normalizeAuthError(error, {
				userMessage: "Authentication failed. Check your credentials and try again.",
			});
		}
		const session = client.getSession();
		if (!session) {
			logger.warn("Two-factor flow completed without a session");
			throw createDriveSyncError("AUTH_REAUTH_REQUIRED", {
				category: "auth",
				userMessage: "Authentication required. Sign in again to continue.",
				debugMessage: "2FA failed. No session returned.",
			});
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
		let session: Session;
		try {
			session = await client.restoreSession(credentials);
		} catch (error) {
			throw normalizeAuthError(error, {
				userMessage: "Session expired. Sign in again to continue.",
			});
		}
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
		let session: Session;
		try {
			session = await client.refreshTokenWithForkRecovery();
		} catch (error) {
			throw normalizeAuthError(error, {
				userMessage: "Session expired. Sign in again to continue.",
			});
		}
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
		const httpClient = createProtonHttpClient(
			() => this.authClient?.getSession() ?? session,
			async () => {
				if (this.authClient) {
					await this.authClient.refreshTokenWithForkRecovery();
				}
			},
		);
		let response: Response;
		try {
			response = await httpClient.fetchJson({
				url: "core/v4/users",
				method: "GET",
				headers: new Headers(),
				timeoutMs: 15000,
			});
		} catch (error) {
			throw normalizeSessionValidationTransportError(error);
		}
		if (!response.ok) {
			throw createDriveSyncError(
				response.status === 401 || response.status === 403
					? "AUTH_REAUTH_REQUIRED"
					: response.status === 429
						? "NETWORK_RATE_LIMITED"
						: response.status >= 500
							? "NETWORK_TEMPORARY_FAILURE"
							: "AUTH_REAUTH_REQUIRED",
				{
					category:
						response.status === 429 || response.status >= 500 ? "network" : "auth",
					retryable: response.status === 429 || response.status >= 500,
					userMessage:
						response.status === 429
							? "Remote provider rate limited requests. The sync will retry automatically."
							: response.status >= 500
								? "Temporary network failure. The sync will retry automatically."
								: "Authentication required. Sign in again to continue.",
					debugMessage: `Session validation failed (${response.status})`,
					details: { status: response.status },
				},
			);
		}
	}
}

function normalizeAuthError(
	error: unknown,
	mapping: {
		userMessage: string;
	},
) {
	const classified = classifyProtonAuthError(error);
	return normalizeUnknownDriveSyncError(error, {
		code: classified?.code,
		category: classified?.category ?? "auth",
		userMessage: classified?.userMessage ?? mapping.userMessage,
		userMessageKey: classified?.userMessageKey,
		retryable: classified?.retryable,
	});
}

function normalizeSessionValidationTransportError(error: unknown) {
	const classified = classifyProtonAuthError(error);
	if (classified) {
		return normalizeUnknownDriveSyncError(error, {
			code: classified.code,
			category: classified.category,
			userMessage: classified.userMessage,
			userMessageKey: classified.userMessageKey,
			retryable: classified.retryable,
		});
	}
	return normalizeUnknownDriveSyncError(error, {
		code: "NETWORK_TEMPORARY_FAILURE",
		category: "network",
		retryable: true,
		userMessage: "Temporary network failure. The sync will retry automatically.",
		userMessageKey: "error.network.temporaryFailure",
	});
}

function classifyProtonAuthError(error: unknown):
	| {
			code:
				| "AUTH_SESSION_EXPIRED"
				| "AUTH_REAUTH_REQUIRED"
				| "AUTH_INVALID_CREDENTIALS"
				| "NETWORK_TIMEOUT"
				| "NETWORK_RATE_LIMITED"
				| "NETWORK_TEMPORARY_FAILURE";
			category: "auth" | "network";
			retryable?: boolean;
			userMessage: string;
			userMessageKey: string;
	  }
	| undefined {
	const apiError = error as Partial<ApiError> | undefined;
	if (isProtonAuthError(error)) {
		switch (error.kind) {
			case "two_factor_required":
				return {
					code: "AUTH_REAUTH_REQUIRED",
					category: "auth",
					userMessage: "Two-factor authentication is required.",
					userMessageKey: "error.auth.twoFactorRequired",
				};
			case "mailbox_password_required":
				return {
					code: "AUTH_REAUTH_REQUIRED",
					category: "auth",
					userMessage: "Mailbox password is required for this account.",
					userMessageKey: "error.auth.mailboxPasswordRequired",
				};
			case "invalid_credentials":
				return {
					code: "AUTH_INVALID_CREDENTIALS",
					category: "auth",
					userMessage: "Authentication failed. Check your credentials and try again.",
					userMessageKey: "error.auth.invalidCredentials",
				};
			case "session_expired":
				return {
					code: "AUTH_SESSION_EXPIRED",
					category: "auth",
					userMessage: "Session expired. Sign in again to continue.",
					userMessageKey: "error.auth.sessionExpired",
				};
			case "invalid_state":
			default:
				return {
					code: "AUTH_REAUTH_REQUIRED",
					category: "auth",
					userMessage: "Authentication required. Sign in again to continue.",
					userMessageKey: "error.auth.reauthRequired",
				};
		}
	}
	const status = typeof apiError?.status === "number" ? apiError.status : undefined;
	const code =
		typeof apiError?.code === "number"
			? apiError.code
			: typeof apiError?.response?.Code === "number"
				? apiError.response.Code
				: undefined;
	if (code === INVALID_REFRESH_TOKEN_CODE) {
		return {
			code: "AUTH_SESSION_EXPIRED",
			category: "auth",
			userMessage: "Session expired. Sign in again to continue.",
			userMessageKey: "error.auth.sessionExpired",
		};
	}
	if (status === 401 || status === 403) {
		return {
			code: "AUTH_REAUTH_REQUIRED",
			category: "auth",
			userMessage: "Authentication required. Sign in again to continue.",
			userMessageKey: "error.auth.reauthRequired",
		};
	}
	if (status === 429) {
		return {
			code: "NETWORK_RATE_LIMITED",
			category: "network",
			retryable: true,
			userMessage:
				"Remote provider rate limited requests. The sync will retry automatically.",
			userMessageKey: "error.network.rateLimited",
		};
	}
	if (status === 408 || status === 425) {
		return {
			code: "NETWORK_TIMEOUT",
			category: "network",
			retryable: true,
			userMessage: "Network request timed out. The sync will retry automatically.",
			userMessageKey: "error.network.timeout",
		};
	}
	if (status !== undefined && status >= 500) {
		return {
			code: "NETWORK_TEMPORARY_FAILURE",
			category: "network",
			retryable: true,
			userMessage: "Temporary network failure. The sync will retry automatically.",
			userMessageKey: "error.network.temporaryFailure",
		};
	}

	const rawMessage =
		error instanceof Error ? error.message : typeof error === "string" ? error : "";
	const message = rawMessage.toLowerCase().trim();
	if (!message) {
		return undefined;
	}

	if (
		message.includes("invalid_refresh_token") ||
		message.includes("invalid refresh token") ||
		message.includes("parent session expired") ||
		message.includes("session expired") ||
		message.includes("re-authenticate")
	) {
		return {
			code: "AUTH_SESSION_EXPIRED",
			category: "auth",
			userMessage: "Session expired. Sign in again to continue.",
			userMessageKey: "error.auth.sessionExpired",
		};
	}

	if (
		message.includes("unauthorized") ||
		message.includes("forbidden") ||
		message.includes("authentication failed") ||
		message.includes("login failed") ||
		message.includes("token refresh failed")
	) {
		return {
			code: "AUTH_REAUTH_REQUIRED",
			category: "auth",
			userMessage: "Authentication required. Sign in again to continue.",
			userMessageKey: "error.auth.reauthRequired",
		};
	}

	if (
		message.includes("invalid credentials") ||
		message.includes("server proof verification failed") ||
		message.includes("unable to verify server identity")
	) {
		return {
			code: "AUTH_INVALID_CREDENTIALS",
			category: "auth",
			userMessage: "Authentication failed. Check your credentials and try again.",
			userMessageKey: "error.auth.invalidCredentials",
		};
	}

	if (
		message.includes("too many") ||
		message.includes("rate limit") ||
		message.includes("rate-limited") ||
		message.includes("throttle")
	) {
		return {
			code: "NETWORK_RATE_LIMITED",
			category: "network",
			retryable: true,
			userMessage:
				"Remote provider rate limited requests. The sync will retry automatically.",
			userMessageKey: "error.network.rateLimited",
		};
	}

	if (
		(error instanceof Error && error.name === "AbortError") ||
		message.includes("timed out") ||
		message.includes("timeout") ||
		message.includes("aborted")
	) {
		return {
			code: "NETWORK_TIMEOUT",
			category: "network",
			retryable: true,
			userMessage: "Network request timed out. The sync will retry automatically.",
			userMessageKey: "error.network.timeout",
		};
	}

	if (
		message.includes("network") ||
		message.includes("temporar") ||
		message.includes("503") ||
		message.includes("500") ||
		message.includes("failed to fetch")
	) {
		return {
			code: "NETWORK_TEMPORARY_FAILURE",
			category: "network",
			retryable: true,
			userMessage: "Temporary network failure. The sync will retry automatically.",
			userMessageKey: "error.network.temporaryFailure",
		};
	}

	return undefined;
}
