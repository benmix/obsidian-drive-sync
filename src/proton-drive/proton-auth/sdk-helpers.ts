import * as openpgp from "openpgp";
import type { Session, ApiResponse, AddressKeyInfo, AuthInfo, SrpResult } from "./types";
import type { ProtonDriveAccount, ProtonDriveAccountAddress } from "@protontech/drive-sdk";
import type { PublicKey as DrivePublicKey } from "@protontech/drive-sdk/dist/crypto/interface";
import { API_BASE_URL, APP_VERSION, AUTH_VERSION, SRP_LEN } from "./types";
import { apiRequest } from "./api";
import type { OpenPGPCryptoInterface } from "./openpgp";
import { getSrp, verifyAndGetModulus } from "./srp";
import {
	base64Encode,
	uint8ArrayToBinaryString,
	uint8ArrayToBigIntLE,
	bigIntToUint8ArrayLE,
	modExp,
	computeKeyPassword,
	hashPassword,
} from "./crypto-utils";

// ============================================================================
// SDK Integration Helpers
// ============================================================================

interface HttpClientRequest {
	url: string;
	method: string;
	headers: Headers;
	json?: Record<string, unknown>;
	body?: BodyInit;
	timeoutMs: number;
	signal?: AbortSignal;
	onProgress?: (progress: number) => void;
}

interface ProtonHttpClient {
	fetchJson(request: HttpClientRequest): Promise<Response>;
	fetchBlob(request: HttpClientRequest): Promise<Response>;
}

type DrivePrivateKey = {
	readonly _idx: openpgp.PrivateKey;
	readonly _dummyType: "private";
};

type OwnAddress = ProtonDriveAccountAddress;

interface SRPVerifier {
	modulusId: string;
	version: number;
	salt: string;
	verifier: string;
}

export interface SRPModuleInterface {
	getSrp(
		version: number,
		modulus: string,
		serverEphemeral: string,
		salt: string,
		password: string,
	): Promise<SrpResult>;
	getSrpVerifier(password: string): Promise<SRPVerifier>;
	computeKeyPassword(password: string, salt: string): Promise<string>;
}

/**
 * Create an HTTP client for the Proton Drive SDK
 */
export function createProtonHttpClient(
	session: Session,
	onTokenRefresh?: () => Promise<void>,
): ProtonHttpClient {
	// Helper to build the full URL - handles both relative and absolute URLs
	const buildUrl = (url: string): string => {
		// If URL is already absolute, use it as-is
		if (url.startsWith("http://") || url.startsWith("https://")) {
			return url;
		}
		// Otherwise, prepend the API base URL
		return `${API_BASE_URL}/${url}`;
	};

	// Helper to update auth headers with current session tokens
	const setAuthHeaders = (headers: Headers) => {
		if (session.UID) {
			headers.set("x-pm-uid", session.UID);
		}
		if (session.AccessToken) {
			headers.set("Authorization", `Bearer ${session.AccessToken}`);
		}
		headers.set("x-pm-appversion", APP_VERSION);
	};

	return {
		async fetchJson(request: HttpClientRequest): Promise<Response> {
			const { url, method, headers, json, timeoutMs, signal } = request;

			// Add auth headers
			setAuthHeaders(headers);

			const fullUrl = buildUrl(url);
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), timeoutMs);

			try {
				let response = await fetch(fullUrl, {
					method,
					headers,
					body: json ? JSON.stringify(json) : undefined,
					signal: signal || controller.signal,
				});

				// Handle expired access token (401) - try to refresh and retry
				if (response.status === 401 && session.RefreshToken && onTokenRefresh) {
					try {
						await onTokenRefresh();
						// Update headers with new token and retry
						setAuthHeaders(headers);
						response = await fetch(fullUrl, {
							method,
							headers,
							body: json ? JSON.stringify(json) : undefined,
							signal: signal || controller.signal,
						});
					} catch {
						// Refresh failed, return original 401 response
					}
				}

				return response;
			} finally {
				clearTimeout(timeout);
			}
		},

		async fetchBlob(request: HttpClientRequest): Promise<Response> {
			const { url, method, headers, body, timeoutMs, signal } = request;

			// Add auth headers
			setAuthHeaders(headers);

			const fullUrl = buildUrl(url);
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), timeoutMs);

			try {
				let response = await fetch(fullUrl, {
					method,
					headers,
					body,
					signal: signal || controller.signal,
				});

				// Handle expired access token (401) - try to refresh and retry
				if (response.status === 401 && session.RefreshToken && onTokenRefresh) {
					try {
						await onTokenRefresh();
						// Update headers with new token and retry
						setAuthHeaders(headers);
						response = await fetch(fullUrl, {
							method,
							headers,
							body,
							signal: signal || controller.signal,
						});
					} catch {
						// Refresh failed, return original 401 response
					}
				}

				return response;
			} finally {
				clearTimeout(timeout);
			}
		},
	};
}

/**
 * Create a Proton account interface for the SDK
 */
export function createProtonAccount(
	session: Session,
	cryptoModule: OpenPGPCryptoInterface,
): ProtonDriveAccount {
	// Cache for decrypted keys to avoid re-decrypting on each call
	const decryptedKeysCache = new Map<string, openpgp.PrivateKey>();

	const wrapPrivateKey = (key: openpgp.PrivateKey): DrivePrivateKey => ({
		_idx: key,
		_dummyType: "private",
	});
	const wrapPublicKey = (key: openpgp.PublicKey): DrivePublicKey => ({
		_idx: key,
	});

	async function decryptAddressKeys(
		keys: AddressKeyInfo[],
	): Promise<{ id: string; key: DrivePrivateKey }[]> {
		const result: { id: string; key: DrivePrivateKey }[] = [];
		for (const k of keys) {
			let decryptedKey = decryptedKeysCache.get(k.ID);
			if (!decryptedKey) {
				decryptedKey = await cryptoModule.decryptKey(k.armoredKey, k.passphrase);
				decryptedKeysCache.set(k.ID, decryptedKey);
			}
			result.push({ id: k.ID, key: wrapPrivateKey(decryptedKey) });
		}
		return result;
	}

	return {
		async getOwnPrimaryAddress(): Promise<OwnAddress> {
			const primaryAddress = session.addresses?.find((a) => a.Type === 1 && a.Status === 1);
			if (!primaryAddress) {
				throw new Error("No primary address found");
			}

			const primaryKeyIndex = primaryAddress.keys.findIndex((k) => k.Primary === 1);
			const keys = await decryptAddressKeys(primaryAddress.keys);
			return {
				email: primaryAddress.Email,
				addressId: primaryAddress.ID,
				primaryKeyIndex: primaryKeyIndex >= 0 ? primaryKeyIndex : 0,
				keys,
			};
		},

		async getOwnAddress(emailOrAddressId: string): Promise<OwnAddress> {
			const address = session.addresses?.find(
				(a) => a.Email === emailOrAddressId || a.ID === emailOrAddressId,
			);
			if (!address) {
				throw new Error(`Address not found: ${emailOrAddressId}`);
			}

			const primaryKeyIndex = address.keys.findIndex((k) => k.Primary === 1);
			const keys = await decryptAddressKeys(address.keys);
			return {
				email: address.Email,
				addressId: address.ID,
				primaryKeyIndex: primaryKeyIndex >= 0 ? primaryKeyIndex : 0,
				keys,
			};
		},
		async getOwnAddresses(): Promise<OwnAddress[]> {
			const addresses = session.addresses ?? [];
			if (addresses.length === 0) {
				throw new Error("No addresses found");
			}

			return Promise.all(
				addresses.map(async (address) => {
					const primaryKeyIndex = address.keys.findIndex((k) => k.Primary === 1);
					const keys = await decryptAddressKeys(address.keys);
					return {
						email: address.Email,
						addressId: address.ID,
						primaryKeyIndex: primaryKeyIndex >= 0 ? primaryKeyIndex : 0,
						keys,
					};
				}),
			);
		},

		async hasProtonAccount(email: string): Promise<boolean> {
			// Query the key transparency endpoint to check if the email has a Proton account
			try {
				const response = await apiRequest<ApiResponse & { Keys?: unknown[] }>(
					"GET",
					`core/v4/keys?Email=${encodeURIComponent(email)}`,
					null,
					session,
				);
				return response.Keys !== undefined && response.Keys.length > 0;
			} catch {
				return false;
			}
		},

		async getPublicKeys(email: string): Promise<DrivePublicKey[]> {
			try {
				const response = await apiRequest<ApiResponse & { Keys?: { PublicKey: string }[] }>(
					"GET",
					`core/v4/keys?Email=${encodeURIComponent(email)}`,
					null,
					session,
				);

				const keys: DrivePublicKey[] = [];
				for (const keyData of response.Keys || []) {
					try {
						const key = await openpgp.readKey({
							armoredKey: keyData.PublicKey,
						});
						keys.push(wrapPublicKey(key));
					} catch {
						// Skip invalid keys
					}
				}
				return keys;
			} catch {
				return [];
			}
		},
	};
}

/**
 * Create an SRP module for the SDK
 */
export function createSrpModule(): SRPModuleInterface {
	return {
		async getSrp(
			version: number,
			modulus: string,
			serverEphemeral: string,
			salt: string,
			password: string,
		): Promise<SrpResult> {
			const authInfo: AuthInfo = {
				Version: version,
				Modulus: modulus,
				ServerEphemeral: serverEphemeral,
				Salt: salt,
			};
			return getSrp(authInfo, { password });
		},

		async getSrpVerifier(password: string): Promise<SRPVerifier> {
			// Fetch modulus from server
			const response = await apiRequest<ApiResponse & { Modulus: string; ModulusID: string }>(
				"GET",
				"core/v4/auth/modulus",
			);
			const modulus = await verifyAndGetModulus(response.Modulus);

			// Generate random salt
			const saltBytes = crypto.getRandomValues(new Uint8Array(10));
			const salt = uint8ArrayToBinaryString(saltBytes);

			// Hash password
			const hashedPassword = await hashPassword({
				version: AUTH_VERSION,
				password,
				salt,
				modulus,
			});

			// Generate verifier
			const generator = 2n;
			const modulusBigInt = uint8ArrayToBigIntLE(modulus.slice().reverse());
			const hashedPasswordBigInt = uint8ArrayToBigIntLE(hashedPassword.slice().reverse());
			const verifier = modExp(generator, hashedPasswordBigInt, modulusBigInt);
			const verifierArray = bigIntToUint8ArrayLE(verifier, SRP_LEN);

			return {
				modulusId: response.ModulusID,
				version: AUTH_VERSION,
				salt: base64Encode(saltBytes),
				verifier: base64Encode(verifierArray),
			};
		},

		async computeKeyPassword(password: string, salt: string): Promise<string> {
			return computeKeyPassword(password, salt);
		},
	};
}
