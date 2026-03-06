import * as openpgp from "openpgp";
import { base64Encode } from "./crypto-utils";

// ============================================================================
// OpenPGP Crypto Wrapper
// ============================================================================

export type SessionKey = openpgp.SessionKey;

export interface OpenPGPCryptoInterface {
	generatePassphrase(): string;
	generateSessionKey(encryptionKeys: openpgp.PrivateKey[]): Promise<SessionKey>;
	encryptSessionKey(
		sessionKey: SessionKey,
		encryptionKeys: openpgp.PublicKey | openpgp.PublicKey[],
	): Promise<{ keyPacket: Uint8Array }>;
	encryptSessionKeyWithPassword(
		sessionKey: SessionKey,
		password: string,
	): Promise<{ keyPacket: Uint8Array }>;
	generateKey(
		passphrase: string,
	): Promise<{ privateKey: openpgp.PrivateKey; armoredKey: string }>;
	encryptArmored(
		data: Uint8Array,
		encryptionKeys: openpgp.PrivateKey[],
		sessionKey?: SessionKey,
	): Promise<{ armoredData: string }>;
	encryptAndSign(
		data: Uint8Array,
		sessionKey: SessionKey,
		encryptionKeys: openpgp.PrivateKey[],
		signingKey: openpgp.PrivateKey,
	): Promise<{ encryptedData: Uint8Array }>;
	encryptAndSignArmored(
		data: Uint8Array,
		sessionKey: SessionKey | undefined,
		encryptionKeys: openpgp.PrivateKey[],
		signingKey: openpgp.PrivateKey,
	): Promise<{ armoredData: string }>;
	encryptAndSignDetached(
		data: Uint8Array,
		sessionKey: SessionKey,
		encryptionKeys: openpgp.PrivateKey[],
		signingKey: openpgp.PrivateKey,
	): Promise<{ encryptedData: Uint8Array; signature: Uint8Array }>;
	encryptAndSignDetachedArmored(
		data: Uint8Array,
		sessionKey: SessionKey,
		encryptionKeys: openpgp.PrivateKey[],
		signingKey: openpgp.PrivateKey,
	): Promise<{ armoredData: string; armoredSignature: string }>;
	sign(
		data: Uint8Array,
		signingKey: openpgp.PrivateKey,
		signatureContext?: string,
	): Promise<{ signature: Uint8Array }>;
	signArmored(
		data: Uint8Array,
		signingKey: openpgp.PrivateKey | openpgp.PrivateKey[],
	): Promise<{ signature: string }>;
	verify(
		data: Uint8Array,
		signature: Uint8Array,
		verificationKeys: openpgp.PublicKey | openpgp.PublicKey[],
	): Promise<{ verified: number; verificationErrors?: Error[] }>;
	verifyArmored(
		data: Uint8Array,
		armoredSignature: string,
		verificationKeys: openpgp.PublicKey | openpgp.PublicKey[],
		signatureContext?: string,
	): Promise<{ verified: number; verificationErrors?: Error[] }>;
	decryptSessionKey(
		data: Uint8Array,
		decryptionKeys: openpgp.PrivateKey | openpgp.PrivateKey[],
	): Promise<SessionKey>;
	decryptArmoredSessionKey(
		armoredData: string,
		decryptionKeys: openpgp.PrivateKey | openpgp.PrivateKey[],
	): Promise<SessionKey>;
	decryptKey(armoredKey: string, passphrase: string): Promise<openpgp.PrivateKey>;
	decryptAndVerify(
		data: Uint8Array,
		sessionKey: SessionKey,
		verificationKeys: openpgp.PublicKey | openpgp.PublicKey[],
	): Promise<{ data: Uint8Array; verified: number }>;
	decryptAndVerifyDetached(
		data: Uint8Array,
		signature: Uint8Array | undefined,
		sessionKey: SessionKey,
		verificationKeys?: openpgp.PublicKey | openpgp.PublicKey[],
	): Promise<{ data: Uint8Array; verified: number }>;
	decryptArmored(
		armoredData: string,
		decryptionKeys: openpgp.PrivateKey | openpgp.PrivateKey[],
	): Promise<Uint8Array>;
	decryptArmoredAndVerify(
		armoredData: string,
		decryptionKeys: openpgp.PrivateKey | openpgp.PrivateKey[],
		verificationKeys: openpgp.PublicKey | openpgp.PublicKey[],
	): Promise<{ data: Uint8Array; verified: number }>;
	decryptArmoredAndVerifyDetached(
		armoredData: string,
		armoredSignature: string | undefined,
		sessionKey: SessionKey,
		verificationKeys: openpgp.PublicKey | openpgp.PublicKey[],
	): Promise<{ data: Uint8Array; verified: number }>;
	decryptArmoredWithPassword(armoredData: string, password: string): Promise<Uint8Array>;
}

const VERIFICATION_STATUS = {
	NOT_SIGNED: 0,
	SIGNED_AND_VALID: 1,
	SIGNED_AND_INVALID: 2,
};

/**
 * Create an OpenPGP crypto wrapper for the SDK
 */
export function createOpenPGPCrypto(): OpenPGPCryptoInterface {
	const toArray = <T>(val: T | T[]): T[] => (Array.isArray(val) ? val : [val]);

	return {
		generatePassphrase(): string {
			const bytes = crypto.getRandomValues(new Uint8Array(32));
			return base64Encode(bytes);
		},

		async generateSessionKey(encryptionKeys: openpgp.PrivateKey[]): Promise<SessionKey> {
			return openpgp.generateSessionKey({
				encryptionKeys: toArray(encryptionKeys),
			});
		},

		async encryptSessionKey(
			sessionKey: SessionKey,
			encryptionKeys: openpgp.PublicKey | openpgp.PublicKey[],
		): Promise<{ keyPacket: Uint8Array }> {
			const result = await openpgp.encryptSessionKey({
				data: sessionKey.data,
				algorithm: sessionKey.algorithm,
				encryptionKeys: toArray(encryptionKeys),
				format: "binary",
			});
			return { keyPacket: result };
		},

		async encryptSessionKeyWithPassword(
			sessionKey: SessionKey,
			password: string,
		): Promise<{ keyPacket: Uint8Array }> {
			const result = await openpgp.encryptSessionKey({
				data: sessionKey.data,
				algorithm: sessionKey.algorithm,
				passwords: [password],
				format: "binary",
			});
			return { keyPacket: result };
		},

		async generateKey(
			passphrase: string,
		): Promise<{ privateKey: openpgp.PrivateKey; armoredKey: string }> {
			// Generate an unencrypted key first
			const { privateKey: decryptedKey } = await openpgp.generateKey({
				type: "ecc",
				curve: "curve25519Legacy",
				userIDs: [{ name: "Drive", email: "drive@proton.me" }],
				format: "object",
			});
			// Encrypt the key with the passphrase for storage
			const encryptedKey = await openpgp.encryptKey({
				privateKey: decryptedKey,
				passphrase,
			});
			const armoredKey = encryptedKey.armor();
			// Return the DECRYPTED key for immediate use, and the ENCRYPTED armored key for storage
			return { privateKey: decryptedKey, armoredKey };
		},

		async encryptArmored(
			data: Uint8Array,
			encryptionKeys: openpgp.PrivateKey[],
			sessionKey?: SessionKey,
		): Promise<{ armoredData: string }> {
			const message = await openpgp.createMessage({ binary: data });
			const armoredData = await openpgp.encrypt({
				message,
				encryptionKeys: toArray(encryptionKeys),
				sessionKey,
				format: "armored",
			});
			return { armoredData };
		},

		async encryptAndSign(
			data: Uint8Array,
			sessionKey: SessionKey,
			encryptionKeys: openpgp.PrivateKey[],
			signingKey: openpgp.PrivateKey,
		): Promise<{ encryptedData: Uint8Array }> {
			const message = await openpgp.createMessage({ binary: data });
			const encryptedData = (await openpgp.encrypt({
				message,
				encryptionKeys: toArray(encryptionKeys),
				signingKeys: [signingKey],
				sessionKey,
				format: "binary",
			})) as Uint8Array;
			return { encryptedData };
		},

		async encryptAndSignArmored(
			data: Uint8Array,
			sessionKey: SessionKey | undefined,
			encryptionKeys: openpgp.PrivateKey[],
			signingKey: openpgp.PrivateKey,
		): Promise<{ armoredData: string }> {
			const message = await openpgp.createMessage({ binary: data });
			const armoredData = (await openpgp.encrypt({
				message,
				encryptionKeys: toArray(encryptionKeys),
				signingKeys: [signingKey],
				sessionKey,
				format: "armored",
			})) as string;
			return { armoredData };
		},

		async encryptAndSignDetached(
			data: Uint8Array,
			sessionKey: SessionKey,
			encryptionKeys: openpgp.PrivateKey[],
			signingKey: openpgp.PrivateKey,
		): Promise<{ encryptedData: Uint8Array; signature: Uint8Array }> {
			const message = await openpgp.createMessage({ binary: data });
			const [encryptedData, signatureResult] = await Promise.all([
				openpgp.encrypt({
					message,
					encryptionKeys: toArray(encryptionKeys),
					sessionKey,
					format: "binary",
				}) as Promise<Uint8Array>,
				openpgp.sign({
					message,
					signingKeys: [signingKey],
					detached: true,
					format: "binary",
				}) as Promise<Uint8Array>,
			]);
			return { encryptedData, signature: signatureResult };
		},

		async encryptAndSignDetachedArmored(
			data: Uint8Array,
			sessionKey: SessionKey,
			encryptionKeys: openpgp.PrivateKey[],
			signingKey: openpgp.PrivateKey,
		): Promise<{ armoredData: string; armoredSignature: string }> {
			const message = await openpgp.createMessage({ binary: data });
			const [armoredData, armoredSignature] = await Promise.all([
				openpgp.encrypt({
					message,
					encryptionKeys: toArray(encryptionKeys),
					sessionKey,
					format: "armored",
				}) as Promise<string>,
				openpgp.sign({
					message,
					signingKeys: [signingKey],
					detached: true,
					format: "armored",
				}) as Promise<string>,
			]);
			return { armoredData, armoredSignature };
		},

		async sign(
			data: Uint8Array,
			signingKey: openpgp.PrivateKey,
			signatureContext?: string,
		): Promise<{ signature: Uint8Array }> {
			const message = await openpgp.createMessage({ binary: data });
			// Context is supported in openpgp but types may not reflect it - ignoring context for now
			void signatureContext;
			const signature = (await openpgp.sign({
				message,
				signingKeys: [signingKey],
				detached: true,
				format: "binary",
			})) as Uint8Array;
			return { signature };
		},

		async signArmored(
			data: Uint8Array,
			signingKey: openpgp.PrivateKey | openpgp.PrivateKey[],
		): Promise<{ signature: string }> {
			const message = await openpgp.createMessage({ binary: data });
			const signature = (await openpgp.sign({
				message,
				signingKeys: toArray(signingKey),
				detached: true,
				format: "armored",
			})) as string;
			return { signature };
		},

		async verify(
			data: Uint8Array,
			signature: Uint8Array,
			verificationKeys: openpgp.PublicKey | openpgp.PublicKey[],
		): Promise<{ verified: number; verificationErrors?: Error[] }> {
			try {
				const message = await openpgp.createMessage({ binary: data });
				const sig = await openpgp.readSignature({
					binarySignature: signature,
				});
				const result = await openpgp.verify({
					message,
					signature: sig,
					verificationKeys: toArray(verificationKeys),
				});

				const verified = await result.signatures[0]?.verified.catch(() => false);
				return {
					verified: verified
						? VERIFICATION_STATUS.SIGNED_AND_VALID
						: VERIFICATION_STATUS.SIGNED_AND_INVALID,
				};
			} catch (error) {
				return {
					verified: VERIFICATION_STATUS.SIGNED_AND_INVALID,
					verificationErrors: [error as Error],
				};
			}
		},

		async verifyArmored(
			data: Uint8Array,
			armoredSignature: string,
			verificationKeys: openpgp.PublicKey | openpgp.PublicKey[],
			signatureContext?: string,
		): Promise<{ verified: number; verificationErrors?: Error[] }> {
			try {
				const message = await openpgp.createMessage({ binary: data });
				const signature = await openpgp.readSignature({
					armoredSignature,
				});
				// Context is supported in openpgp but types may not reflect it - ignoring for now
				void signatureContext;
				const result = await openpgp.verify({
					message,
					signature,
					verificationKeys: toArray(verificationKeys),
				});

				const verified = await result.signatures[0]?.verified.catch(() => false);
				return {
					verified: verified
						? VERIFICATION_STATUS.SIGNED_AND_VALID
						: VERIFICATION_STATUS.SIGNED_AND_INVALID,
				};
			} catch (error) {
				return {
					verified: VERIFICATION_STATUS.SIGNED_AND_INVALID,
					verificationErrors: [error as Error],
				};
			}
		},

		async decryptSessionKey(
			data: Uint8Array,
			decryptionKeys: openpgp.PrivateKey | openpgp.PrivateKey[],
		): Promise<SessionKey> {
			const message = await openpgp.readMessage({ binaryMessage: data });
			const result = await openpgp.decryptSessionKeys({
				message,
				decryptionKeys: toArray(decryptionKeys),
			});
			return result[0] as SessionKey;
		},

		async decryptArmoredSessionKey(
			armoredData: string,
			decryptionKeys: openpgp.PrivateKey | openpgp.PrivateKey[],
		): Promise<SessionKey> {
			const message = await openpgp.readMessage({
				armoredMessage: armoredData,
			});
			const result = await openpgp.decryptSessionKeys({
				message,
				decryptionKeys: toArray(decryptionKeys),
			});
			return result[0] as SessionKey;
		},

		async decryptKey(armoredKey: string, passphrase: string): Promise<openpgp.PrivateKey> {
			const privateKey = await openpgp.readPrivateKey({ armoredKey });
			return await openpgp.decryptKey({ privateKey, passphrase });
		},

		async decryptAndVerify(
			data: Uint8Array,
			sessionKey: SessionKey,
			verificationKeys: openpgp.PublicKey | openpgp.PublicKey[],
		): Promise<{ data: Uint8Array; verified: number }> {
			const message = await openpgp.readMessage({ binaryMessage: data });
			const result = await openpgp.decrypt({
				message,
				sessionKeys: [sessionKey],
				verificationKeys: toArray(verificationKeys),
				format: "binary",
			});

			let verified = VERIFICATION_STATUS.NOT_SIGNED;
			if (result.signatures?.length) {
				const signature = result.signatures[0];
				if (signature) {
					const sigVerified = await signature.verified.catch(() => false);
					verified = sigVerified
						? VERIFICATION_STATUS.SIGNED_AND_VALID
						: VERIFICATION_STATUS.SIGNED_AND_INVALID;
				}
			}

			return { data: result.data as Uint8Array, verified };
		},

		async decryptAndVerifyDetached(
			data: Uint8Array,
			signature: Uint8Array | undefined,
			sessionKey: SessionKey,
			verificationKeys?: openpgp.PublicKey | openpgp.PublicKey[],
		): Promise<{ data: Uint8Array; verified: number }> {
			const message = await openpgp.readMessage({ binaryMessage: data });
			const result = await openpgp.decrypt({
				message,
				sessionKeys: [sessionKey],
				format: "binary",
			});

			let verified = VERIFICATION_STATUS.NOT_SIGNED;
			if (signature && verificationKeys) {
				const sig = await openpgp.readSignature({
					binarySignature: signature,
				});
				const verifyResult = await openpgp.verify({
					message: await openpgp.createMessage({
						binary: result.data as Uint8Array,
					}),
					signature: sig,
					verificationKeys: toArray(verificationKeys),
				});
				const sigVerified = await verifyResult.signatures[0]?.verified.catch(() => false);
				verified = sigVerified
					? VERIFICATION_STATUS.SIGNED_AND_VALID
					: VERIFICATION_STATUS.SIGNED_AND_INVALID;
			}

			return { data: result.data as Uint8Array, verified };
		},

		async decryptArmored(
			armoredData: string,
			decryptionKeys: openpgp.PrivateKey | openpgp.PrivateKey[],
		): Promise<Uint8Array> {
			const message = await openpgp.readMessage({
				armoredMessage: armoredData,
			});
			const result = await openpgp.decrypt({
				message,
				decryptionKeys: toArray(decryptionKeys),
				format: "binary",
			});
			return result.data as Uint8Array;
		},

		async decryptArmoredAndVerify(
			armoredData: string,
			decryptionKeys: openpgp.PrivateKey | openpgp.PrivateKey[],
			verificationKeys: openpgp.PublicKey | openpgp.PublicKey[],
		): Promise<{ data: Uint8Array; verified: number }> {
			const message = await openpgp.readMessage({
				armoredMessage: armoredData,
			});
			const result = await openpgp.decrypt({
				message,
				decryptionKeys: toArray(decryptionKeys),
				verificationKeys: toArray(verificationKeys),
				format: "binary",
			});

			let verified = VERIFICATION_STATUS.NOT_SIGNED;
			if (result.signatures?.length) {
				const signature = result.signatures[0];
				if (signature) {
					const sigVerified = await signature.verified.catch(() => false);
					verified = sigVerified
						? VERIFICATION_STATUS.SIGNED_AND_VALID
						: VERIFICATION_STATUS.SIGNED_AND_INVALID;
				}
			}

			return { data: result.data as Uint8Array, verified };
		},

		async decryptArmoredAndVerifyDetached(
			armoredData: string,
			armoredSignature: string | undefined,
			sessionKey: SessionKey,
			verificationKeys: openpgp.PublicKey | openpgp.PublicKey[],
		): Promise<{ data: Uint8Array; verified: number }> {
			const message = await openpgp.readMessage({
				armoredMessage: armoredData,
			});
			const result = await openpgp.decrypt({
				message,
				sessionKeys: [sessionKey],
				format: "binary",
			});

			let verified = VERIFICATION_STATUS.NOT_SIGNED;
			if (armoredSignature && verificationKeys) {
				const signature = await openpgp.readSignature({
					armoredSignature,
				});
				const verifyResult = await openpgp.verify({
					message: await openpgp.createMessage({
						binary: result.data as Uint8Array,
					}),
					signature,
					verificationKeys: toArray(verificationKeys),
				});
				const sigVerified = await verifyResult.signatures[0]?.verified.catch(() => false);
				verified = sigVerified
					? VERIFICATION_STATUS.SIGNED_AND_VALID
					: VERIFICATION_STATUS.SIGNED_AND_INVALID;
			}

			return { data: result.data as Uint8Array, verified };
		},

		async decryptArmoredWithPassword(
			armoredData: string,
			password: string,
		): Promise<Uint8Array> {
			const message = await openpgp.readMessage({
				armoredMessage: armoredData,
			});
			const result = await openpgp.decrypt({
				message,
				passwords: [password],
				format: "binary",
			});
			return result.data as Uint8Array;
		},
	};
}

/**
 * Initialize crypto (openpgp configuration)
 */
export async function initCrypto(): Promise<void> {
	// Configure openpgp for optimal performance
	openpgp.config.allowInsecureDecryptionWithSigningKeys = true;
}

// Export openpgp for external use
export { openpgp };
