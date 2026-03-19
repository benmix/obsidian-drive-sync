import type {
	ApiError,
	ApiResponse,
	AuthResponse,
	PasswordMode,
	ReusableCredentials,
	Session,
} from "../../../../../../contracts/provider/proton/auth-types";
import { INVALID_REFRESH_TOKEN_CODE } from "../../../../../../contracts/provider/proton/auth-types";
import { logger } from "../../logger";
import { createForkEncryptedBlob, decryptForkEncryptedBlob } from "../crypto/crypto-utils";
import { getSrp } from "../crypto/srp";
import { ProtonAuthApiClient } from "../transport/api-client";

import { createProtonAuthError, isProtonAuthError } from "./auth-errors";
import type { ProtonBootstrapData } from "./auth-state";
import { ProtonAuthKeyService } from "./key-service";
import { ProtonAuthSessionStore } from "./session-store";

export class ProtonAuth {
	private readonly store = new ProtonAuthSessionStore();

	constructor(
		private readonly apiClient = new ProtonAuthApiClient(),
		private readonly keyService = new ProtonAuthKeyService(),
	) {}

	async login(
		username: string,
		password: string,
		twoFactorCode: string | null = null,
	): Promise<Session> {
		const authInfo = await this.apiClient.getAuthInfo(username);
		const { clientEphemeral, clientProof, expectedServerProof } = await getSrp(authInfo, {
			password,
		});
		const authData: Record<string, unknown> = {
			Username: username,
			ClientEphemeral: clientEphemeral,
			ClientProof: clientProof,
			SRPSession: authInfo.SRPSession,
			PersistentCookies: 0,
		};
		if (twoFactorCode) {
			authData.TwoFactorCode = twoFactorCode;
		}

		const authResponse = await this.apiClient.authenticate(authData);
		if (authResponse.ServerProof !== expectedServerProof) {
			throw createProtonAuthError("invalid_credentials", {
				message: "Server proof verification failed",
			});
		}

		if (authResponse["2FA"]?.Enabled && !twoFactorCode) {
			const session = this.createWorkingSession(authResponse, authResponse.PasswordMode);
			this.store.beginTwoFactorChallenge(
				session,
				password,
				authResponse,
				authResponse["2FA"],
			);
			throw createProtonAuthError("two_factor_required", {
				twoFactorInfo: authResponse["2FA"],
			});
		}

		const parentSession = this.createParentSession(authResponse, authResponse.PasswordMode);
		if ((authResponse.PasswordMode ?? 1) === 2) {
			this.store.beginMailboxPasswordChallenge(parentSession, {
				...parentSession,
			});
			throw createProtonAuthError("mailbox_password_required");
		}

		const enrichedParent = await this.bootstrapAuthenticatedParent(parentSession, password);
		return await this.completeAuthentication(enrichedParent);
	}

	async submit2FA(code: string): Promise<Session> {
		const state = this.store.requirePendingTwoFactorState();
		const response = await this.apiClient.submitTwoFactor(code, state.session);
		const updatedSession = this.applyUpdatedTokens(state.session, response);
		const parentSession = this.createParentSession(updatedSession, updatedSession.passwordMode);

		if (updatedSession.passwordMode === 2) {
			this.store.beginMailboxPasswordChallenge(parentSession, {
				...parentSession,
			});
			throw createProtonAuthError("mailbox_password_required");
		}

		const enrichedParent = await this.bootstrapAuthenticatedParent(
			parentSession,
			state.loginPassword,
		);
		return await this.completeAuthentication(enrichedParent);
	}

	async submitMailboxPassword(mailboxPassword: string): Promise<Session> {
		const state = this.store.requirePendingMailboxPasswordState();
		const bootstrap = await this.loadBootstrap(state.session);
		const parentSession = await this.keyService.hydrateSessionFromPassword(
			state.parentSession,
			mailboxPassword,
			bootstrap,
		);
		return await this.completeAuthentication(parentSession);
	}

	getSession(): Session | null {
		return this.store.getSession();
	}

	getReusableCredentials(): ReusableCredentials {
		const authenticated = this.store.requireAuthenticatedState();
		const { parentSession, childSession } = authenticated;
		if (!childSession.keyPassword) {
			throw new Error("No key password available - authentication incomplete");
		}
		if (!childSession.UserID) {
			throw new Error("No user ID available - authentication incomplete");
		}
		return {
			parentUID: parentSession.UID,
			parentAccessToken: parentSession.AccessToken,
			parentRefreshToken: parentSession.RefreshToken,
			childUID: childSession.UID,
			childAccessToken: childSession.AccessToken,
			childRefreshToken: childSession.RefreshToken,
			SaltedKeyPass: childSession.keyPassword,
			UserID: childSession.UserID,
			passwordMode: childSession.passwordMode ?? 1,
		};
	}

	async restoreSession(credentials: ReusableCredentials): Promise<Session> {
		const parentSession: Session = {
			UID: credentials.parentUID,
			AccessToken: credentials.parentAccessToken,
			RefreshToken: credentials.parentRefreshToken,
			UserID: credentials.UserID,
			keyPassword: credentials.SaltedKeyPass,
			passwordMode: credentials.passwordMode,
		};
		const childSession: Session = {
			UID: credentials.childUID,
			AccessToken: credentials.childAccessToken,
			RefreshToken: credentials.childRefreshToken,
			UserID: credentials.UserID,
			keyPassword: credentials.SaltedKeyPass,
			passwordMode: credentials.passwordMode,
		};
		this.store.setAuthenticated({
			parentSession,
			childSession,
		});

		try {
			const bootstrap = {
				user: await this.apiClient.getUserWithRefresh(
					() => this.store.getSession(),
					async () => {
						await this.refreshToken();
					},
				),
				addresses: await this.apiClient.getAddressesWithRefresh(
					() => this.store.getSession(),
					async () => {
						await this.refreshToken();
					},
				),
			};
			const enrichedChild = await this.keyService.hydrateRestoredSession(
				this.requireChildSession(),
				credentials.SaltedKeyPass,
				credentials.passwordMode,
				bootstrap,
			);
			this.store.setAuthenticated({
				parentSession: this.mergeParentSession(parentSession, enrichedChild),
				childSession: enrichedChild,
			});
			return enrichedChild;
		} catch (error) {
			this.store.clear();
			throw this.normalizeRestoreError(error);
		}
	}

	async refreshToken(): Promise<Session> {
		const session = this.requireChildSession();
		if (!session.RefreshToken) {
			throw new Error("No refresh token available");
		}

		try {
			const tokens = await this.apiClient.refreshTokens(session.UID, session.RefreshToken);
			const updatedSession = {
				...session,
				AccessToken: tokens.accessToken,
				RefreshToken: tokens.refreshToken,
			};
			this.syncChildSession(updatedSession);
			return updatedSession;
		} catch (error) {
			if (this.isInvalidRefreshTokenError(error)) {
				logger.info(
					"Child session refresh token expired, attempting to fork new session from parent...",
				);
				return await this.attemptForkRecovery();
			}
			throw error;
		}
	}

	async refreshTokenWithForkRecovery(): Promise<Session> {
		try {
			return await this.refreshToken();
		} catch (error) {
			if (this.isInvalidRefreshTokenError(error) && this.store.getParentSession()) {
				logger.info("Refresh token invalid, attempting fork recovery");
				return await this.forkNewChildSession();
			}
			throw error;
		}
	}

	async forkNewChildSession(options: { refreshParent?: boolean } = {}): Promise<Session> {
		const authenticated = this.store.requireAuthenticatedState();
		try {
			const forked = await this.forkChildSession(
				authenticated.parentSession,
				authenticated.childSession,
				options,
			);
			this.store.setAuthenticated(forked);
			return forked.childSession;
		} catch (error) {
			if (this.isInvalidRefreshTokenError(error)) {
				this.store.clear();
			}
			throw error;
		}
	}

	async logout(): Promise<void> {
		const sessions = [this.store.getSession(), this.store.getParentSession()].filter(
			(session): session is Session => Boolean(session?.UID && session?.AccessToken),
		);
		const revoked = new Set<string>();
		for (const session of sessions) {
			const key = `${session.UID}:${session.AccessToken}`;
			if (revoked.has(key)) {
				continue;
			}
			revoked.add(key);
			try {
				await this.apiClient.revokeSession(session);
			} catch {
				// Ignore logout errors.
			}
		}
		this.store.clear();
	}

	private async bootstrapAuthenticatedParent(
		parentSession: Session,
		password: string,
	): Promise<Session> {
		const bootstrap = await this.loadBootstrap(parentSession);
		return await this.keyService.hydrateSessionFromPassword(parentSession, password, bootstrap);
	}

	private async loadBootstrap(session: Session): Promise<ProtonBootstrapData> {
		return {
			user: await this.apiClient.getUser(session),
			keySalts: await this.apiClient.getKeySalts(session),
			addresses: await this.apiClient.getAddresses(session),
		};
	}

	private applyUpdatedTokens(
		session: Session,
		response: ApiResponse & { AccessToken?: string; RefreshToken?: string },
	): Session {
		return {
			...session,
			AccessToken: response.AccessToken ?? session.AccessToken,
			RefreshToken: response.RefreshToken ?? session.RefreshToken,
		};
	}

	private createWorkingSession(authResponse: AuthResponse, passwordMode?: number): Session {
		return {
			UID: authResponse.UID,
			AccessToken: authResponse.AccessToken,
			RefreshToken: authResponse.RefreshToken,
			UserID: authResponse.UserID,
			Scope: authResponse.Scope,
			passwordMode: (passwordMode ?? 1) as PasswordMode,
		};
	}

	private createParentSession(
		source: Pick<
			Session,
			"UID" | "AccessToken" | "RefreshToken" | "UserID" | "Scope" | "passwordMode"
		>,
		passwordMode?: number,
	): Session {
		return {
			UID: source.UID,
			AccessToken: source.AccessToken,
			RefreshToken: source.RefreshToken,
			UserID: source.UserID,
			Scope: source.Scope,
			passwordMode: (passwordMode ?? source.passwordMode ?? 1) as PasswordMode,
		};
	}

	private requireChildSession(): Session {
		const session = this.store.getSession();
		if (!session) {
			throw createProtonAuthError("invalid_state", {
				message: "No session available",
			});
		}
		return session;
	}

	private requireParentSession(): Session {
		const session = this.store.getParentSession();
		if (!session) {
			throw createProtonAuthError("session_expired", {
				message:
					"Parent session not available. Please re-authenticate with: proton-drive-sync auth",
			});
		}
		return session;
	}

	private syncChildSession(childSession: Session): void {
		const state = this.store.getState();
		if (state.kind === "authenticated") {
			this.store.updateAuthenticatedChildSession(childSession);
		}
	}

	private async attemptForkRecovery(): Promise<Session> {
		const parentSession = this.store.getParentSession();
		if (!parentSession?.RefreshToken || !parentSession.keyPassword) {
			throw createProtonAuthError("session_expired", {
				message:
					"Parent session not available. Please re-authenticate with: proton-drive-sync auth",
			});
		}

		try {
			await this.refreshParentToken();
			return await this.forkNewChildSession({ refreshParent: false });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(
				`Failed to recover session: ${errorMessage}. Please re-authenticate with: proton-drive-sync auth`,
			);
		}
	}

	private async refreshParentToken(): Promise<void> {
		const parentSession = this.requireParentSession();
		if (!parentSession.RefreshToken) {
			throw new Error("No parent refresh token available");
		}

		try {
			const tokens = await this.apiClient.refreshTokens(
				parentSession.UID,
				parentSession.RefreshToken,
			);
			const updatedParent = {
				...parentSession,
				AccessToken: tokens.accessToken,
				RefreshToken: tokens.refreshToken,
			};
			if (this.store.getState().kind === "authenticated") {
				this.store.updateAuthenticatedParentSession(updatedParent);
			}
		} catch (error) {
			if (this.isInvalidRefreshTokenError(error)) {
				throw createProtonAuthError("session_expired", {
					message: "Parent session expired. Please re-authenticate.",
				});
			}
			throw error;
		}
	}

	private async completeAuthentication(parentSession: Session): Promise<Session> {
		logger.info("Forking child session from parent...");
		try {
			const forked = await this.forkChildSession(parentSession, parentSession);
			this.store.setAuthenticated(forked);
			logger.info("Authentication completed");
			return forked.childSession;
		} catch (error) {
			this.store.clear();
			throw error;
		}
	}

	private async forkChildSession(
		parentSession: Session,
		currentChild: Session,
		options: { refreshParent?: boolean } = {},
	): Promise<{ parentSession: Session; childSession: Session }> {
		if (!parentSession.keyPassword) {
			throw new Error("Parent session missing keyPassword for fork payload");
		}

		logger.info("Forking new child session from parent session");

		try {
			const activeParent =
				options.refreshParent === false
					? parentSession
					: await this.refreshParentSession(parentSession);
			if (!activeParent.keyPassword) {
				throw new Error("No keyPassword available from refreshed parent session");
			}
			const { key: encryptionKey, blob } = await createForkEncryptedBlob(
				activeParent.keyPassword,
			);
			const pushResponse = await this.apiClient.pushForkSession(activeParent, blob);
			const pullResponse = await this.apiClient.pullForkSession(
				pushResponse.Selector,
				activeParent,
			);

			const keyPassword = pullResponse.Payload
				? await decryptForkEncryptedBlob(encryptionKey, pullResponse.Payload)
				: activeParent.keyPassword;
			const childSession: Session = {
				...currentChild,
				UID: pullResponse.UID,
				AccessToken: pullResponse.AccessToken,
				RefreshToken: pullResponse.RefreshToken,
				UserID: pullResponse.UserID,
				keyPassword,
			};
			logger.info("Successfully forked new child session");
			return {
				parentSession: activeParent,
				childSession,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.error(`Failed to fork child session: ${message}`);
			throw error;
		}
	}

	private async refreshParentSession(parentSession: Session): Promise<Session> {
		if (!parentSession.RefreshToken) {
			throw new Error("No parent refresh token available");
		}

		try {
			const tokens = await this.apiClient.refreshTokens(
				parentSession.UID,
				parentSession.RefreshToken,
			);
			return {
				...parentSession,
				AccessToken: tokens.accessToken,
				RefreshToken: tokens.refreshToken,
			};
		} catch (error) {
			if (this.isInvalidRefreshTokenError(error)) {
				throw createProtonAuthError("session_expired", {
					message: "Parent session expired. Please re-authenticate.",
				});
			}
			throw error;
		}
	}

	private mergeParentSession(parentSession: Session, childSession: Session): Session {
		return {
			...parentSession,
			keyPassword: childSession.keyPassword,
			user: childSession.user,
			primaryKey: childSession.primaryKey,
			addresses: childSession.addresses,
		};
	}

	private isInvalidRefreshTokenError(error: unknown): boolean {
		if (isProtonAuthError(error)) {
			return error.kind === "session_expired";
		}
		const apiError = error as Partial<ApiError> | undefined;
		const code =
			typeof apiError?.code === "number"
				? apiError.code
				: typeof apiError?.response?.Code === "number"
					? apiError.response.Code
					: undefined;
		if (code === INVALID_REFRESH_TOKEN_CODE) {
			return true;
		}
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			return (
				message.includes("10013") ||
				message.includes("invalid_refresh_token") ||
				message.includes("invalid refresh token") ||
				message.includes("refresh token") ||
				message.includes("session expired")
			);
		}
		return false;
	}

	private normalizeRestoreError(error: unknown): Error {
		if (isProtonAuthError(error)) {
			return error;
		}
		if (error instanceof Error) {
			return error;
		}
		return createProtonAuthError("session_expired", {
			message: "Failed to restore session.",
			cause: error,
		});
	}
}
