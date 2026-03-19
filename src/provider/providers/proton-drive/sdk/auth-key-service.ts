import type {
	Address,
	AddressData,
	KeySalt,
	PasswordMode,
	Session,
	User,
} from "@contracts/provider/proton/auth-types";
import { computeKeyPassword } from "@provider/providers/proton-drive/sdk/crypto/crypto-utils";
import { logger } from "@provider/providers/proton-drive/sdk/logger";
import { decrypt, decryptKey, type PrivateKey, readMessage, readPrivateKey } from "openpgp";

export class ProtonAuthKeyService {
	async hydrateSessionFromPassword(
		session: Session,
		password: string,
		bootstrap: {
			user: User;
			keySalts: KeySalt[];
			addresses: Address[];
		},
	): Promise<Session> {
		const enrichedSession: Session = {
			...session,
			user: bootstrap.user,
		};
		const primaryKey = bootstrap.user.Keys?.[0];
		if (primaryKey) {
			const keySalt = bootstrap.keySalts.find((salt) => salt.ID === primaryKey.ID);
			if (keySalt?.KeySalt) {
				const keyPassword = await computeKeyPassword(password, keySalt.KeySalt);
				enrichedSession.keyPassword = keyPassword;
				try {
					const privateKey = await readPrivateKey({
						armoredKey: primaryKey.PrivateKey,
					});
					enrichedSession.primaryKey = await decryptKey({
						privateKey,
						passphrase: keyPassword,
					});
				} catch (error) {
					logger.warn("Failed to decrypt primary key:", (error as Error).message);
				}
			}
		}
		enrichedSession.addresses = await this.processAddressKeys(
			bootstrap.addresses,
			bootstrap.keySalts,
			enrichedSession.keyPassword || "",
			password,
			enrichedSession.passwordMode ?? 1,
			enrichedSession.primaryKey,
		);
		return enrichedSession;
	}

	async hydrateRestoredSession(
		session: Session,
		saltedKeyPass: string,
		passwordMode: PasswordMode,
		bootstrap: {
			user: User;
			addresses: Address[];
		},
	): Promise<Session> {
		const enrichedSession: Session = {
			...session,
			user: bootstrap.user,
			keyPassword: saltedKeyPass,
		};
		const primaryUserKey = bootstrap.user.Keys?.[0];
		if (primaryUserKey && saltedKeyPass) {
			try {
				const privateKey = await readPrivateKey({
					armoredKey: primaryUserKey.PrivateKey,
				});
				enrichedSession.primaryKey = await decryptKey({
					privateKey,
					passphrase: saltedKeyPass,
				});
			} catch (error) {
				if (passwordMode === 2) {
					throw new Error(
						"Failed to decrypt primary user key in two-password mode. Re-authentication required.",
					);
				}
				logger.warn("Failed to decrypt primary user key:", (error as Error).message);
			}
		}

		enrichedSession.addresses = await this.processAddressKeys(
			bootstrap.addresses,
			[],
			saltedKeyPass,
			undefined,
			passwordMode,
			enrichedSession.primaryKey,
		);
		return enrichedSession;
	}

	private async processAddressKeys(
		addresses: Address[],
		keySalts: KeySalt[],
		keyPassword: string,
		password: string | undefined,
		passwordMode: PasswordMode,
		primaryKey?: PrivateKey,
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
					if (key.Token && primaryKey) {
						const decryptedToken = await decrypt({
							message: await readMessage({
								armoredMessage: key.Token,
							}),
							decryptionKeys: primaryKey,
						});
						addressKeyPassword = decryptedToken.data as string;
					} else if (key.Token && passwordMode === 2) {
						throw new Error(
							`Address key ${key.ID} has Token but primary key is not available. Re-authentication required.`,
						);
					} else if (password) {
						const keySalt = keySalts.find((salt) => salt.ID === key.ID);
						if (keySalt?.KeySalt) {
							addressKeyPassword = await computeKeyPassword(
								password,
								keySalt.KeySalt,
							);
						}
					}

					if (!addressKeyPassword) {
						if (passwordMode === 2) {
							throw new Error(
								`Failed to derive passphrase for address key ${key.ID} in two-password mode. Re-authentication required.`,
							);
						}
						addressKeyPassword = keyPassword;
					}

					if (addressKeyPassword && passwordMode === 2) {
						try {
							const privateKey = await readPrivateKey({
								armoredKey: key.PrivateKey,
							});
							await decryptKey({
								privateKey,
								passphrase: addressKeyPassword,
							});
						} catch {
							throw new Error(
								`Address key ${key.ID} passphrase verification failed. Re-authentication required.`,
							);
						}
					}

					addressData.keys.push({
						ID: key.ID,
						Primary: key.Primary,
						armoredKey: key.PrivateKey,
						passphrase: addressKeyPassword,
					});
				} catch (error) {
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
}
