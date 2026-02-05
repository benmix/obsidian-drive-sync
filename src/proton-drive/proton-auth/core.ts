import * as openpgp from "openpgp";
import { logger } from "../logger";
import type {
	Session,
	ApiError,
	ApiResponse,
	AuthInfo,
	AuthResponse,
	ReusableCredentials,
	PasswordMode,
	User,
	KeySalt,
	Address,
	PushForkResponse,
	PullForkResponse,
	AddressData,
} from "./types";
import { INVALID_REFRESH_TOKEN_CODE, APP_VERSION, CHILD_CLIENT_ID, API_BASE_URL } from "./types";
import { apiRequest, createHeaders } from "./api";
import { getSrp } from "./srp";
import {
	computeKeyPassword,
	createForkEncryptedBlob,
	decryptForkEncryptedBlob,
} from "./crypto-utils";
import { requestHttp } from "./http";

// ============================================================================
// ProtonAuth Class
// ============================================================================

/**
 * Proton authentication handler
 *
 * Usage:
 * ```
 * const auth = new ProtonAuth();
 * const session = await auth.login(username, password);
 *
 * // If 2FA is required:
 * if (session.requires2FA) {
 *     await auth.submit2FA(code);
 * }
 *
 * // Get session info
 * const { UID, AccessToken, RefreshToken, keyPassword, addresses } = auth.getSession();
 *
 * // Logout
 * await auth.logout();
 * ```
 */
export class ProtonAuth {
	private session: Session | null = null;
	private parentSession: Session | null = null;
	private pendingAuthResponse: AuthResponse | null = null;

	/**
	 * Make an API request with automatic token refresh on 401
	 */
	private async apiRequestWithRefresh<T extends ApiResponse>(
		method: string,
		endpoint: string,
		data: Record<string, unknown> | null = null,
	): Promise<T> {
		if (!this.session) {
			throw new Error("No session available");
		}

		try {
			return await apiRequest<T>(method, endpoint, data, this.session);
		} catch (error) {
			const apiError = error as ApiError;
			// Handle expired access token (401) - try to refresh and retry
			if (apiError.status === 401 && this.session?.RefreshToken) {
				logger.info("Access token expired, attempting refresh...");
				await this.refreshToken();
				// Retry with new token
				return await apiRequest<T>(method, endpoint, data, this.session);
			}
			throw error;
		}
	}

	/**
	 * Authenticate with username and password
	 */
	async login(
		username: string,
		password: string,
		twoFactorCode: string | null = null,
	): Promise<Session> {
		// Get auth info
		const authInfo = await apiRequest<AuthInfo & ApiResponse>("POST", "core/v4/auth/info", {
			Username: username,
		});

		// Generate SRP proofs
		const { clientEphemeral, clientProof, expectedServerProof } = await getSrp(authInfo, {
			password,
		});

		// Authenticate
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

		const authResponse = await apiRequest<AuthResponse>("POST", "core/v4/auth", authData);

		// Verify server proof
		if (authResponse.ServerProof !== expectedServerProof) {
			throw new Error("Server proof verification failed");
		}

		// Check if 2FA is required
		if (authResponse["2FA"]?.Enabled && !twoFactorCode) {
			this.pendingAuthResponse = authResponse;
			this.session = {
				UID: authResponse.UID,
				AccessToken: authResponse.AccessToken,
				RefreshToken: authResponse.RefreshToken,
				passwordMode: (authResponse.PasswordMode ?? 1) as PasswordMode,
			};

			const error = new Error("2FA required") as ApiError;
			error.requires2FA = true;
			error.twoFAInfo = authResponse["2FA"];
			// Store password for use after 2FA
			this.session.password = password;
			throw error;
		}

		// Check for two-password mode (PasswordMode: 1 = Single, 2 = Dual)
		const passwordMode = (authResponse.PasswordMode ?? 1) as PasswordMode;
		if (passwordMode === 2) {
			// Two-password mode - need separate mailbox password for key decryption
			this.parentSession = {
				UID: authResponse.UID,
				AccessToken: authResponse.AccessToken,
				RefreshToken: authResponse.RefreshToken,
				UserID: authResponse.UserID,
				Scope: authResponse.Scope,
				passwordMode: 2,
			};
			this.session = { ...this.parentSession };

			const error = new Error("Mailbox password required") as ApiError;
			error.requiresMailboxPassword = true;
			throw error;
		}

		// Store as parent session first (single password mode)
		this.parentSession = {
			UID: authResponse.UID,
			AccessToken: authResponse.AccessToken,
			RefreshToken: authResponse.RefreshToken,
			UserID: authResponse.UserID,
			Scope: authResponse.Scope,
			passwordMode: 1,
		};

		// Fetch user data and keys using parent session temporarily
		this.session = this.parentSession;
		await this._fetchUserAndKeys(password);

		// Store keyPassword in parent session for fork payload encryption
		this.parentSession.keyPassword = this.session.keyPassword;
		this.parentSession.user = this.session.user;
		this.parentSession.primaryKey = this.session.primaryKey;
		this.parentSession.addresses = this.session.addresses;

		// Fork a child session for API operations
		logger.info("Forking child session from parent...");
		await this.forkNewChildSession();

		return this.session;
	}

	/**
	 * Submit 2FA code
	 */
	async submit2FA(code: string): Promise<Session> {
		if (!this.session?.UID) {
			throw new Error("No pending 2FA authentication");
		}

		const response = await apiRequest<
			ApiResponse & { AccessToken?: string; RefreshToken?: string }
		>("POST", "core/v4/auth/2fa", { TwoFactorCode: code }, this.session);

		// Update session with new tokens if provided
		if (response.AccessToken) {
			this.session.AccessToken = response.AccessToken;
		}
		if (response.RefreshToken) {
			this.session.RefreshToken = response.RefreshToken;
		}

		// Store as parent session
		this.parentSession = {
			UID: this.session.UID,
			AccessToken: this.session.AccessToken,
			RefreshToken: this.session.RefreshToken,
			UserID: this.session.UserID,
			Scope: this.session.Scope,
			passwordMode: this.session.passwordMode,
		};

		// Check if this is a two-password mode account
		if (this.session.passwordMode === 2) {
			// Still need mailbox password - throw to let caller handle
			const error = new Error("Mailbox password required") as ApiError;
			error.requiresMailboxPassword = true;
			throw error;
		}

		// Now fetch user data and decrypt keys (this was deferred during login due to 2FA)
		// Single password mode - use stored login password for key decryption
		if (this.session.password) {
			await this._fetchUserAndKeys(this.session.password);

			// Store keyPassword in parent session for fork payload encryption
			this.parentSession.keyPassword = this.session.keyPassword;
			this.parentSession.user = this.session.user;
			this.parentSession.primaryKey = this.session.primaryKey;
			this.parentSession.addresses = this.session.addresses;

			// Fork a child session for API operations
			logger.info("Forking child session from parent...");
			await this.forkNewChildSession();
		}

		return this.session;
	}

	/**
	 * Submit mailbox password for two-password mode accounts
	 */
	async submitMailboxPassword(mailboxPassword: string): Promise<Session> {
		if (!this.session?.UID) {
			throw new Error("No pending authentication - call login() first");
		}
		if (this.session.passwordMode !== 2) {
			throw new Error("Mailbox password not required for this account");
		}

		// Use MAILBOX password (not login password) for key decryption
		await this._fetchUserAndKeys(mailboxPassword);

		// Update parent session with key data
		this.parentSession!.keyPassword = this.session.keyPassword;
		this.parentSession!.user = this.session.user;
		this.parentSession!.primaryKey = this.session.primaryKey;
		this.parentSession!.addresses = this.session.addresses;

		// Fork a child session for API operations
		logger.info("Forking child session from parent...");
		await this.forkNewChildSession();

		return this.session;
	}

	/**
	 * Process addresses and their keys into AddressData format
	 * Shared helper used by _fetchUserAndKeys and restoreSession
	 */
	private async _processAddressKeys(
		addresses: Address[],
		keySalts: KeySalt[],
		keyPassword: string,
		password?: string,
		passwordMode: number = 1, // 1 = single, 2 = two-password mode
	): Promise<AddressData[]> {
		const result: AddressData[] = [];

		for (const address of addresses) {
			const addressData: AddressData = {
				ID: address.ID,
				Email: address.Email,
				Type: address.Type,
				Status: address.Status,
				keys: [],
			};

			for (const key of address.Keys || []) {
				try {
					let addressKeyPassword: string | undefined;

					// If the key has a Token, decrypt it using the user's primary key
					if (key.Token && this.session?.primaryKey) {
						const decryptedToken = await openpgp.decrypt({
							message: await openpgp.readMessage({
								armoredMessage: key.Token,
							}),
							decryptionKeys: this.session.primaryKey,
						});
						addressKeyPassword = decryptedToken.data as string;
					} else if (key.Token && passwordMode === 2) {
						// Two-password mode requires Token decryption - fail if primaryKey unavailable
						throw new Error(
							`Address key ${key.ID} has Token but primary key is not available. Re-authentication required.`,
						);
					} else if (password) {
						// Use password-derived key if password is available (single-password mode)
						const keySalt = keySalts.find((s) => s.ID === key.ID);
						if (keySalt?.KeySalt) {
							addressKeyPassword = await computeKeyPassword(
								password,
								keySalt.KeySalt,
							);
						}
					}

					// Fallback to the user's key password - only valid for single-password mode
					if (!addressKeyPassword) {
						if (passwordMode === 2) {
							throw new Error(
								`Failed to derive passphrase for address key ${key.ID} in two-password mode. Re-authentication required.`,
							);
						}
						addressKeyPassword = keyPassword;
					}

					// Verify passphrase by attempting to decrypt the address key (two-password mode only)
					if (addressKeyPassword && passwordMode === 2) {
						try {
							const privateKey = await openpgp.readPrivateKey({
								armoredKey: key.PrivateKey,
							});
							await openpgp.decryptKey({
								privateKey,
								passphrase: addressKeyPassword,
							});
						} catch {
							throw new Error(
								`Address key ${key.ID} passphrase verification failed. Re-authentication required.`,
							);
						}
					}

					if (addressKeyPassword) {
						// Store armored key and passphrase instead of decrypted key
						// This allows the SDK to decrypt using its own openpgp instance
						addressData.keys.push({
							ID: key.ID,
							Primary: key.Primary,
							armoredKey: key.PrivateKey,
							passphrase: addressKeyPassword,
						});
					}
				} catch (error) {
					// In two-password mode, all errors are fatal
					if (passwordMode === 2) {
						throw new Error(
							`Failed to process address key ${key.ID}: ${(error as Error).message}`,
						);
					}
					logger.warn(
						`Failed to process address key ${key.ID}:`,
						(error as Error).message,
					);
				}
			}

			result.push(addressData);
		}

		return result;
	}

	/**
	 * Fetch user information and decrypt keys
	 */
	private async _fetchUserAndKeys(password: string): Promise<void> {
		if (!this.session) {
			throw new Error("No session available");
		}

		// Fetch user info
		const userResponse = await apiRequest<ApiResponse & { User: User }>(
			"GET",
			"core/v4/users",
			null,
			this.session,
		);
		this.session.user = userResponse.User;

		// Fetch key salts
		const saltsResponse = await apiRequest<ApiResponse & { KeySalts?: KeySalt[] }>(
			"GET",
			"core/v4/keys/salts",
			null,
			this.session,
		);
		const keySalts = saltsResponse.KeySalts || [];

		// Fetch addresses
		const addressesResponse = await apiRequest<ApiResponse & { Addresses?: Address[] }>(
			"GET",
			"core/v4/addresses",
			null,
			this.session,
		);
		const addresses = addressesResponse.Addresses || [];

		// Find primary key and its salt
		const primaryKey = this.session.user?.Keys?.[0];
		if (primaryKey) {
			const keySalt = keySalts.find((s) => s.ID === primaryKey.ID);

			if (keySalt?.KeySalt) {
				// Compute key password from password and salt
				const keyPassword = await computeKeyPassword(password, keySalt.KeySalt);
				this.session.keyPassword = keyPassword;

				// Try to decrypt the primary key
				try {
					const privateKey = await openpgp.readPrivateKey({
						armoredKey: primaryKey.PrivateKey,
					});
					const decryptedKey = await openpgp.decryptKey({
						privateKey,
						passphrase: keyPassword,
					});
					this.session.primaryKey = decryptedKey;
				} catch (error) {
					logger.warn("Failed to decrypt primary key:", (error as Error).message);
				}
			}
		}

		// Process addresses and their keys using the shared helper
		this.session.addresses = await this._processAddressKeys(
			addresses,
			keySalts,
			this.session.keyPassword || "",
			password,
			this.session.passwordMode ?? 1,
		);
	}

	/**
	 * Get current session
	 */
	getSession(): Session | null {
		return this.session;
	}

	/**
	 * Get credentials for session reuse (like rclone stores)
	 */
	getReusableCredentials(): ReusableCredentials {
		if (!this.session || !this.parentSession) {
			throw new Error("Not authenticated");
		}
		if (!this.session.keyPassword) {
			throw new Error("No key password available - authentication incomplete");
		}
		if (!this.session.UserID) {
			throw new Error("No user ID available - authentication incomplete");
		}
		return {
			parentUID: this.parentSession.UID,
			parentAccessToken: this.parentSession.AccessToken,
			parentRefreshToken: this.parentSession.RefreshToken,
			childUID: this.session.UID,
			childAccessToken: this.session.AccessToken,
			childRefreshToken: this.session.RefreshToken,
			SaltedKeyPass: this.session.keyPassword,
			UserID: this.session.UserID,
			passwordMode: this.session.passwordMode ?? 1,
		};
	}

	/**
	 * Restore session from stored credentials
	 */
	async restoreSession(credentials: ReusableCredentials): Promise<Session> {
		const {
			parentUID,
			parentAccessToken,
			parentRefreshToken,
			childUID,
			childAccessToken,
			childRefreshToken,
			SaltedKeyPass,
		} = credentials;

		// Restore parent session
		this.parentSession = {
			UID: parentUID,
			AccessToken: parentAccessToken,
			RefreshToken: parentRefreshToken,
			keyPassword: SaltedKeyPass,
			passwordMode: credentials.passwordMode,
		};

		// Restore child session (the active working session)
		this.session = {
			UID: childUID,
			AccessToken: childAccessToken,
			RefreshToken: childRefreshToken,
			keyPassword: SaltedKeyPass,
			passwordMode: credentials.passwordMode,
		};

		// Helper to refresh token when needed
		// Verify the session is still valid by fetching user info
		try {
			const userResponse = await this.apiRequestWithRefresh<ApiResponse & { User: User }>(
				"GET",
				"core/v4/users",
			);
			this.session.user = userResponse.User;

			// First, decrypt the user's primary key
			const primaryUserKey = this.session.user?.Keys?.[0];
			if (primaryUserKey && SaltedKeyPass) {
				try {
					const privateKey = await openpgp.readPrivateKey({
						armoredKey: primaryUserKey.PrivateKey,
					});
					const decryptedKey = await openpgp.decryptKey({
						privateKey,
						passphrase: SaltedKeyPass,
					});
					this.session.primaryKey = decryptedKey;
				} catch (error) {
					// In two-password mode, primary key decryption is required for address key Token decryption
					if (credentials.passwordMode === 2) {
						throw new Error(
							`Failed to decrypt primary user key in two-password mode. Re-authentication required.`,
						);
					}
					logger.warn("Failed to decrypt primary user key:", (error as Error).message);
				}
			}

			// Fetch addresses
			const addressesResponse = await this.apiRequestWithRefresh<
				ApiResponse & { Addresses?: Address[] }
			>("GET", "core/v4/addresses");
			const addresses = addressesResponse.Addresses || [];

			// Process addresses and their keys using the shared helper
			// Note: No keySalts needed here since we use SaltedKeyPass directly
			this.session.addresses = await this._processAddressKeys(
				addresses,
				[],
				SaltedKeyPass,
				undefined,
				credentials.passwordMode,
			);

			return this.session;
		} catch (error) {
			this.session = null;
			throw new Error(`Failed to restore session: ${(error as Error).message}`);
		}
	}

	/**
	 * Shared helper to refresh a session's tokens
	 * Used by refreshToken, refreshParentToken, and forkNewChildSession
	 */
	private async _refreshSessionTokens(
		uid: string,
		refreshToken: string,
	): Promise<{ accessToken: string; refreshToken: string }> {
		const response = await requestHttp(
			`${API_BASE_URL}/auth/refresh`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-pm-appversion": APP_VERSION,
					"x-pm-uid": uid,
				},
				body: JSON.stringify({
					ResponseType: "token",
					GrantType: "refresh_token",
					RefreshToken: refreshToken,
					RedirectURI: "https://protonmail.com",
				}),
			},
			"json",
		);

		const json = (await response.json()) as ApiResponse & {
			AccessToken?: string;
			RefreshToken?: string;
		};

		if (!response.ok || json.Code !== 1000) {
			if (json.Code === INVALID_REFRESH_TOKEN_CODE) {
				throw new Error("INVALID_REFRESH_TOKEN");
			}
			throw new Error(json.Error || "Token refresh failed");
		}

		if (!json.AccessToken || !json.RefreshToken) {
			throw new Error("Token refresh response missing tokens");
		}

		return {
			accessToken: json.AccessToken,
			refreshToken: json.RefreshToken,
		};
	}

	/**
	 * Refresh the access token (child session)
	 * If refresh fails with invalid refresh token error, attempts to fork a new child session from parent
	 */
	async refreshToken(): Promise<Session> {
		if (!this.session?.RefreshToken) {
			throw new Error("No refresh token available");
		}

		try {
			const tokens = await this._refreshSessionTokens(
				this.session.UID,
				this.session.RefreshToken,
			);
			this.session.AccessToken = tokens.accessToken;
			this.session.RefreshToken = tokens.refreshToken;
			return this.session;
		} catch (error) {
			// Check if this is an invalid refresh token error
			if (this.isInvalidRefreshTokenError(error)) {
				logger.info(
					"Child session refresh token expired, attempting to fork new session from parent...",
				);
				return await this.attemptForkRecovery();
			}
			throw error;
		}
	}

	/**
	 * Attempt to recover from an expired child session by forking a new one from the parent
	 */
	private async attemptForkRecovery(): Promise<Session> {
		if (!this.parentSession?.RefreshToken || !this.parentSession?.keyPassword) {
			throw new Error(
				"Parent session not available. Please re-authenticate with: proton-drive-sync auth",
			);
		}

		try {
			// First, try to refresh the parent session
			await this.refreshParentToken();

			// Fork a new child session from the refreshed parent
			await this.forkNewChildSession();

			logger.info("Successfully forked new child session from parent");
			return this.session!;
		} catch (error) {
			// If parent refresh or forking fails, user needs to re-authenticate
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new Error(
				`Failed to recover session: ${errorMessage}. Please re-authenticate with: proton-drive-sync auth`,
			);
		}
	}

	/**
	 * Refresh the parent session's access token
	 */
	private async refreshParentToken(): Promise<void> {
		if (!this.parentSession?.RefreshToken) {
			throw new Error("No parent refresh token available");
		}

		try {
			const tokens = await this._refreshSessionTokens(
				this.parentSession.UID,
				this.parentSession.RefreshToken,
			);
			this.parentSession.AccessToken = tokens.accessToken;
			this.parentSession.RefreshToken = tokens.refreshToken;
		} catch (error) {
			if (this.isInvalidRefreshTokenError(error)) {
				throw new Error("Parent session expired. Please re-authenticate.");
			}
			throw error;
		}
	}

	/**
	 * Check if an error indicates an invalid/expired refresh token
	 */
	private isInvalidRefreshTokenError(error: unknown): boolean {
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			// Check for error code 10013 or related messages
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

	/**
	 * Push a fork session request to create a child session
	 * Uses the parent session credentials to create a new fork
	 */
	private async pushForkSession(
		parentSession: Session,
	): Promise<{ selector: string; encryptionKey: Uint8Array }> {
		if (!parentSession.keyPassword) {
			throw new Error("Parent session missing keyPassword for fork payload");
		}

		// Encrypt the keyPassword for the fork payload
		const { key: encryptionKey, blob: encryptedPayload } = await createForkEncryptedBlob(
			parentSession.keyPassword,
		);

		const response = await requestHttp(
			`${API_BASE_URL}/auth/v4/sessions/forks`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-pm-appversion": APP_VERSION,
					"x-pm-uid": parentSession.UID,
					Authorization: `Bearer ${parentSession.AccessToken}`,
				},
				body: JSON.stringify({
					Payload: encryptedPayload,
					ChildClientID: CHILD_CLIENT_ID,
					Independent: 0, // Dependent child session (matches macOS client)
				}),
			},
			"json",
		);

		const json = (await response.json()) as ApiResponse & PushForkResponse;

		if (!response.ok || json.Code !== 1000) {
			throw new Error(json.Error || "Failed to push fork session");
		}

		if (!json.Selector) {
			throw new Error("Fork response missing Selector");
		}

		return { selector: json.Selector, encryptionKey };
	}

	/**
	 * Pull a fork session to obtain child session credentials
	 */
	private async pullForkSession(
		selector: string,
		encryptionKey: Uint8Array,
		parentSession: Session,
	): Promise<{
		UID: string;
		AccessToken: string;
		RefreshToken: string;
		UserID: string;
		keyPassword: string;
	}> {
		const response = await requestHttp(
			`${API_BASE_URL}/auth/v4/sessions/forks/${selector}`,
			{
				method: "GET",
				headers: {
					"x-pm-appversion": APP_VERSION,
					"x-pm-uid": parentSession.UID,
					Authorization: `Bearer ${parentSession.AccessToken}`,
				},
			},
			"json",
		);

		const json = (await response.json()) as ApiResponse & PullForkResponse;

		if (!response.ok || json.Code !== 1000) {
			throw new Error(json.Error || "Failed to pull fork session");
		}

		if (!json.UID || !json.AccessToken || !json.RefreshToken) {
			throw new Error("Fork response missing required session data");
		}

		// Decrypt the keyPassword from the payload
		let keyPassword: string;
		if (json.Payload) {
			keyPassword = await decryptForkEncryptedBlob(encryptionKey, json.Payload);
		} else {
			// Fallback to parent's keyPassword if no payload
			if (!parentSession.keyPassword) {
				throw new Error("No keyPassword available from fork or parent");
			}
			keyPassword = parentSession.keyPassword;
		}

		return {
			UID: json.UID,
			AccessToken: json.AccessToken,
			RefreshToken: json.RefreshToken,
			UserID: json.UserID,
			keyPassword,
		};
	}

	/**
	 * Fork a new child session from the parent session
	 * This is used to recover when the child session's refresh token expires
	 */
	async forkNewChildSession(): Promise<Session> {
		if (!this.parentSession) {
			throw new Error("No parent session available - re-authentication required");
		}

		logger.info("Forking new child session from parent session");

		try {
			// First, try to refresh the parent session to ensure it's still valid
			try {
				const tokens = await this._refreshSessionTokens(
					this.parentSession.UID,
					this.parentSession.RefreshToken,
				);
				this.parentSession.AccessToken = tokens.accessToken;
				this.parentSession.RefreshToken = tokens.refreshToken;
			} catch (error) {
				// Parent session is also expired - need full re-auth
				if (this.isInvalidRefreshTokenError(error)) {
					throw new Error("Parent session expired - re-authentication required");
				}
				throw error;
			}

			// Push fork request using parent session
			const { selector, encryptionKey } = await this.pushForkSession(this.parentSession);

			// Pull the new child session
			const childSession = await this.pullForkSession(
				selector,
				encryptionKey,
				this.parentSession,
			);

			// Update the working session with new child credentials
			if (!this.session) {
				this.session = { ...this.parentSession };
			}

			this.session.UID = childSession.UID;
			this.session.AccessToken = childSession.AccessToken;
			this.session.RefreshToken = childSession.RefreshToken;
			this.session.keyPassword = childSession.keyPassword;
			this.session.UserID = childSession.UserID;

			logger.info("Successfully forked new child session");

			return this.session;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.error(`Failed to fork child session: ${message}`);

			// Clear parent session if it's expired
			if (
				message.includes("Parent session expired") ||
				message.includes("INVALID_REFRESH_TOKEN")
			) {
				this.parentSession = null;
			}

			throw error;
		}
	}

	/**
	 * Refresh the access token with fork recovery
	 * If the refresh token is invalid/expired, attempts to fork a new child session
	 */
	async refreshTokenWithForkRecovery(): Promise<Session> {
		try {
			return await this.refreshToken();
		} catch (error) {
			if (this.isInvalidRefreshTokenError(error) && this.parentSession) {
				logger.info("Refresh token invalid, attempting fork recovery");
				return await this.forkNewChildSession();
			}
			throw error;
		}
	}

	/**
	 * Logout and revoke the session
	 */
	async logout(): Promise<void> {
		if (!this.session?.UID) {
			return;
		}

		try {
			await requestHttp(
				`${API_BASE_URL}/core/v4/auth`,
				{
					method: "DELETE",
					headers: createHeaders(this.session),
				},
				"json",
			);
		} catch {
			// Ignore logout errors
		}

		this.session = null;
	}
}
