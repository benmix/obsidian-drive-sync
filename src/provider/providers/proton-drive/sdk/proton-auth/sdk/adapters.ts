import type {
	AddressKeyInfo,
	ApiResponse,
	AuthInfo,
	Session,
	SrpResult,
} from "@contracts/provider/proton/auth-types";
import {
	API_BASE_URL,
	APP_VERSION,
	AUTH_VERSION,
	SRP_LEN,
} from "@contracts/provider/proton/auth-types";
import type { OpenPGPCryptoInterface } from "@contracts/provider/proton/openpgp";
import type {
	DriveAccountPrivateKey,
	DriveAccountPublicKey,
	OwnAddress,
} from "@contracts/provider/proton/sdk-adapters";
import type { SRPModuleInterface, SRPVerifier } from "@contracts/provider/proton/srp-module";
import type {
	ProtonDriveAccount,
	ProtonDriveHTTPClient,
	ProtonDriveHTTPClientBlobRequest,
	ProtonDriveHTTPClientJsonRequest,
} from "@protontech/drive-sdk";
import { wrapPrivateKey, wrapPublicKey } from "@provider/providers/proton-drive/sdk/openpgp-proxy";
import {
	base64Encode,
	bigIntToUint8ArrayLE,
	computeKeyPassword,
	hashPassword,
	modExp,
	uint8ArrayToBigIntLE,
	uint8ArrayToBinaryString,
} from "@provider/providers/proton-drive/sdk/proton-auth/crypto/crypto-utils";
import {
	getSrp,
	verifyAndGetModulus,
} from "@provider/providers/proton-drive/sdk/proton-auth/crypto/srp";
import { apiRequest } from "@provider/providers/proton-drive/sdk/proton-auth/transport/api";
import { requestHttp } from "@provider/providers/proton-drive/sdk/proton-auth/transport/http";
import { type PrivateKey, readKey } from "openpgp";

// ============================================================================
// SDK Integration Helpers
// ============================================================================

function getRequiredSession(getSession: () => Session | null): Session {
	const currentSession = getSession();
	if (!currentSession) {
		throw new Error("No session available");
	}
	return currentSession;
}

/**
 * Create an HTTP client for the Proton Drive SDK
 */
export function createProtonHttpClient(
	session: Session | (() => Session | null),
	onTokenRefresh?: () => Promise<void>,
): ProtonDriveHTTPClient {
	const getSession = (): Session | null => (typeof session === "function" ? session() : session);

	const buildUrl = (url: string): string => {
		if (url.startsWith("http://") || url.startsWith("https://")) {
			return url;
		}
		return `${API_BASE_URL}/${url}`;
	};

	const setAuthHeaders = (headers: Headers) => {
		const currentSession = getSession();
		if (!currentSession) {
			return;
		}
		if (currentSession.UID) {
			headers.set("x-pm-uid", currentSession.UID);
		}
		if (currentSession.AccessToken) {
			headers.set("Authorization", `Bearer ${currentSession.AccessToken}`);
		}
		headers.set("x-pm-appversion", APP_VERSION);
	};

	const normalizeBody = (body: BodyInit | undefined): BodyInit | undefined => {
		return body;
	};

	const executeAuthorizedRequest = async (
		input: {
			url: string;
			method: string;
			headers: Headers;
			body?: BodyInit;
			timeoutMs?: number;
			signal?: AbortSignal;
		},
		responseType: "json" | "arrayBuffer",
	): Promise<Response> => {
		const fullUrl = buildUrl(input.url);
		const requestOnce = async () =>
			await requestHttp(
				fullUrl,
				{
					method: input.method,
					headers: input.headers,
					body: normalizeBody(input.body),
					timeoutMs: input.timeoutMs,
					signal: input.signal,
				},
				responseType,
			);

		setAuthHeaders(input.headers);
		const initialResponse = await requestOnce();
		const currentSession = getSession();
		if (initialResponse.status !== 401 || !currentSession?.RefreshToken || !onTokenRefresh) {
			return initialResponse;
		}
		try {
			await onTokenRefresh();
			setAuthHeaders(input.headers);
			return await requestOnce();
		} catch {
			return initialResponse;
		}
	};

	return {
		async fetchJson(request: ProtonDriveHTTPClientJsonRequest): Promise<Response> {
			const { url, method, headers, json, timeoutMs, signal } = request;
			return await executeAuthorizedRequest(
				{
					url,
					method,
					headers,
					body: json ? JSON.stringify(json) : undefined,
					timeoutMs,
					signal,
				},
				"json",
			);
		},

		async fetchBlob(request: ProtonDriveHTTPClientBlobRequest): Promise<Response> {
			const { url, method, headers, body, timeoutMs, signal } = request;
			return await executeAuthorizedRequest(
				{
					url,
					method,
					headers,
					body,
					timeoutMs,
					signal,
				},
				"arrayBuffer",
			);
		},
	};
}

/**
 * Create a Proton account interface for the SDK
 */
export function createProtonAccount(
	session: Session | (() => Session | null),
	cryptoModule: OpenPGPCryptoInterface,
): ProtonDriveAccount {
	const getSession = (): Session | null => (typeof session === "function" ? session() : session);

	// Cache for decrypted keys to avoid re-decrypting on each call
	const decryptedKeysCache = new Map<string, PrivateKey>();

	async function decryptAddressKeys(
		keys: AddressKeyInfo[],
	): Promise<{ id: string; key: DriveAccountPrivateKey }[]> {
		const result: { id: string; key: DriveAccountPrivateKey }[] = [];
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
			const currentSession = getRequiredSession(getSession);
			const primaryAddress = currentSession.addresses?.find(
				(a) => a.Type === 1 && a.Status === 1,
			);
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
			const currentSession = getRequiredSession(getSession);
			const address = currentSession.addresses?.find(
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
			const currentSession = getRequiredSession(getSession);
			const addresses = currentSession.addresses ?? [];
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
			const currentSession = getRequiredSession(getSession);
			// Query the key transparency endpoint to check if the email has a Proton account
			try {
				const response = await apiRequest<ApiResponse & { Keys?: unknown[] }>(
					"GET",
					`core/v4/keys?Email=${encodeURIComponent(email)}`,
					null,
					currentSession,
				);
				return response.Keys !== undefined && response.Keys.length > 0;
			} catch {
				return false;
			}
		},

		async getPublicKeys(email: string): Promise<DriveAccountPublicKey[]> {
			const currentSession = getRequiredSession(getSession);
			try {
				const response = await apiRequest<ApiResponse & { Keys?: { PublicKey: string }[] }>(
					"GET",
					`core/v4/keys?Email=${encodeURIComponent(email)}`,
					null,
					currentSession,
				);

				const keys: DriveAccountPublicKey[] = [];
				for (const keyData of response.Keys || []) {
					try {
						const key = await readKey({
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
