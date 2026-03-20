import type { AddressKeyInfo, ApiResponse, Session } from "@contracts/provider/proton/auth-types";
import type { OpenPGPCryptoInterface } from "@contracts/provider/proton/openpgp";
import type {
	DriveAccountPrivateKey,
	DriveAccountPublicKey,
	OwnAddress,
} from "@contracts/provider/proton/sdk-adapters";
import type { ProtonDriveAccount } from "@protontech/drive-sdk";
import { wrapPrivateKey, wrapPublicKey } from "@provider/providers/proton-drive/sdk/openpgp-proxy";
import { apiRequest } from "@provider/providers/proton-drive/transport/api";
import { type PrivateKey, readKey } from "openpgp";

function getRequiredSession(getSession: () => Session | null): Session {
	const currentSession = getSession();
	if (!currentSession) {
		throw new Error("No session available");
	}
	return currentSession;
}

export function createProtonAccount(
	session: Session | (() => Session | null),
	cryptoModule: OpenPGPCryptoInterface,
): ProtonDriveAccount {
	const getSession = (): Session | null => (typeof session === "function" ? session() : session);
	const decryptedKeysCache = new Map<string, PrivateKey>();

	async function decryptAddressKeys(
		keys: AddressKeyInfo[],
	): Promise<{ id: string; key: DriveAccountPrivateKey }[]> {
		const result: { id: string; key: DriveAccountPrivateKey }[] = [];
		for (const keyInfo of keys) {
			let decryptedKey = decryptedKeysCache.get(keyInfo.ID);
			if (!decryptedKey) {
				decryptedKey = await cryptoModule.decryptKey(
					keyInfo.armoredKey,
					keyInfo.passphrase,
				);
				decryptedKeysCache.set(keyInfo.ID, decryptedKey);
			}
			result.push({ id: keyInfo.ID, key: wrapPrivateKey(decryptedKey) });
		}
		return result;
	}

	return {
		async getOwnPrimaryAddress(): Promise<OwnAddress> {
			const currentSession = getRequiredSession(getSession);
			const primaryAddress = currentSession.addresses?.find(
				(address) => address.Type === 1 && address.Status === 1,
			);
			if (!primaryAddress) {
				throw new Error("No primary address found");
			}

			const primaryKeyIndex = primaryAddress.keys.findIndex((key) => key.Primary === 1);
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
				(entry) => entry.Email === emailOrAddressId || entry.ID === emailOrAddressId,
			);
			if (!address) {
				throw new Error(`Address not found: ${emailOrAddressId}`);
			}

			const primaryKeyIndex = address.keys.findIndex((key) => key.Primary === 1);
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

			return await Promise.all(
				addresses.map(async (address) => {
					const primaryKeyIndex = address.keys.findIndex((key) => key.Primary === 1);
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
						// Skip invalid keys returned by the transparency endpoint.
					}
				}
				return keys;
			} catch {
				return [];
			}
		},
	};
}
