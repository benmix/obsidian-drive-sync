import type {
	DrivePrivateKey,
	DrivePublicKey,
	DriveSessionKey,
	EncryptMessageArmoredDetachedResult,
	EncryptMessageArmoredResult,
	EncryptMessageBinaryDetachedResult,
	EncryptMessageBinaryResult,
	EncryptMessageOptions,
	SessionKeyWithMetadata,
	VerificationStatus,
} from "@contracts/provider/proton/openpgp-proxy";
import type { OpenPGPCryptoProxy } from "@protontech/drive-sdk";
import {
	createMessage,
	decrypt,
	decryptKey,
	decryptSessionKeys,
	encrypt,
	encryptKey,
	encryptSessionKey,
	enums,
	generateKey,
	generateSessionKey,
	type PrivateKey as OpenPGPPrivateKey,
	type PublicKey as OpenPGPPublicKey,
	type SessionKey as OpenPGPSessionKey,
	readMessage,
	readPrivateKey,
	readSignature,
	sign,
	verify,
} from "openpgp";

const openpgp = {
	createMessage,
	decrypt,
	decryptKey,
	decryptSessionKeys,
	encrypt,
	encryptKey,
	encryptSessionKey,
	enums,
	generateKey,
	generateSessionKey,
	readMessage,
	readPrivateKey,
	readSignature,
	sign,
	verify,
};

type OpenPGPSymmetricName = OpenPGPSessionKey["algorithm"];
type OpenPGPAeadName = Exclude<OpenPGPSessionKey["aeadAlgorithm"], null | undefined>;

const sessionKeyStore = new WeakMap<DriveSessionKey, OpenPGPSessionKey>();
const SESSION_KEY_ALGORITHM_FIELD = "__openpgpAlgorithm";

const VERIFICATION_NOT_SIGNED = 0 as VerificationStatus;
const VERIFICATION_SIGNED_AND_VALID = 1 as VerificationStatus;
const VERIFICATION_SIGNED_AND_INVALID = 2 as VerificationStatus;

function toStrictUint8Array(data: Uint8Array | ArrayBufferLike): Uint8Array<ArrayBuffer> {
	return new Uint8Array(
		data instanceof Uint8Array ? data : new Uint8Array(data),
	) as Uint8Array<ArrayBuffer>;
}

export function wrapPublicKey(key: OpenPGPPublicKey): DrivePublicKey {
	const wrapped = key as OpenPGPPublicKey & {
		_idx?: OpenPGPPublicKey;
		_keyContentHash?: [string, string];
	};
	if (!wrapped._idx) {
		Object.defineProperty(wrapped, "_idx", {
			value: key,
			configurable: true,
		});
	}
	if (!wrapped._keyContentHash) {
		const fingerprint = key.getFingerprint();
		Object.defineProperty(wrapped, "_keyContentHash", {
			value: [fingerprint, fingerprint] as const,
			configurable: true,
		});
	}
	return wrapped as unknown as DrivePublicKey;
}

export function wrapPrivateKey(key: OpenPGPPrivateKey): DrivePrivateKey {
	const wrapped = wrapPublicKey(key) as unknown as OpenPGPPrivateKey & {
		_dummyType?: "private";
	};
	if (!wrapped._dummyType) {
		Object.defineProperty(wrapped, "_dummyType", {
			value: "private",
			configurable: true,
		});
	}
	return wrapped as unknown as DrivePrivateKey;
}

function unwrapPublicKey(key: DrivePublicKey): OpenPGPPublicKey {
	const raw = key._idx;
	if (!raw || typeof raw !== "object") {
		throw new Error("Invalid OpenPGP public key.");
	}
	return raw as OpenPGPPublicKey;
}

function unwrapPrivateKey(key: DrivePrivateKey): OpenPGPPrivateKey {
	const raw = key._idx;
	if (!raw || typeof raw !== "object") {
		throw new Error("Invalid OpenPGP private key.");
	}
	return raw as OpenPGPPrivateKey;
}

function unwrapPrivateKeys(keys: DrivePrivateKey | DrivePrivateKey[]): OpenPGPPrivateKey[] {
	return (Array.isArray(keys) ? keys : [keys]).map(unwrapPrivateKey);
}

function unwrapPublicKeys(keys: DrivePublicKey | DrivePublicKey[]): OpenPGPPublicKey[] {
	return (Array.isArray(keys) ? keys : [keys]).map(unwrapPublicKey);
}

function wrapSessionKey(key: OpenPGPSessionKey): DriveSessionKey {
	const sessionKey: SessionKeyWithMetadata = {
		data: toStrictUint8Array(key.data),
		algorithm: key.algorithm,
		aeadAlgorithm: key.aeadAlgorithm ?? null,
		[SESSION_KEY_ALGORITHM_FIELD]: (key.algorithm as OpenPGPSymmetricName | null) ?? undefined,
	};
	sessionKeyStore.set(sessionKey, key);
	return sessionKey;
}

function unwrapSessionKey(key: DriveSessionKey): OpenPGPSessionKey {
	const stored = sessionKeyStore.get(key);
	if (!stored) {
		const withMetadata = key as SessionKeyWithMetadata;
		const algorithm =
			withMetadata[SESSION_KEY_ALGORITHM_FIELD] ??
			inferSessionKeyAlgorithm(withMetadata.data);
		if (withMetadata.data && algorithm) {
			return {
				data: toStrictUint8Array(withMetadata.data),
				algorithm,
				aeadAlgorithm:
					(withMetadata.aeadAlgorithm as OpenPGPAeadName | null | undefined) ?? undefined,
			};
		}
		throw new Error("Session key is missing OpenPGP metadata.");
	}
	return stored;
}

function inferSessionKeyAlgorithm(data?: Uint8Array): OpenPGPSymmetricName | undefined {
	if (!data) {
		return undefined;
	}
	if (data.byteLength === 16) {
		return "aes128";
	}
	if (data.byteLength === 24) {
		return "aes192";
	}
	if (data.byteLength === 32) {
		return "aes256";
	}
	return undefined;
}

function toVerificationStatus(verified: boolean | undefined): VerificationStatus {
	return verified ? VERIFICATION_SIGNED_AND_VALID : VERIFICATION_SIGNED_AND_INVALID;
}

function requireSigningKeys(signingKeys: DrivePrivateKey | undefined): DrivePrivateKey {
	if (!signingKeys) {
		throw new Error("Signing keys are required for detached mode.");
	}
	return signingKeys;
}

function buildCompressionConfig(compress?: boolean) {
	return compress
		? undefined
		: {
				preferredCompressionAlgorithm: openpgp.enums.compression.uncompressed,
			};
}

function encryptMessage(
	options: EncryptMessageOptions & {
		format?: "armored";
		detached?: false | undefined;
	},
): Promise<EncryptMessageArmoredResult>;
function encryptMessage(
	options: EncryptMessageOptions & {
		format?: "armored";
		detached: true;
		signingKeys: DrivePrivateKey;
	},
): Promise<EncryptMessageArmoredDetachedResult>;
function encryptMessage(
	options: EncryptMessageOptions & {
		format: "binary";
		detached?: false | undefined;
	},
): Promise<EncryptMessageBinaryResult>;
function encryptMessage(
	options: EncryptMessageOptions & {
		format: "binary";
		detached: true;
		signingKeys: DrivePrivateKey;
	},
): Promise<EncryptMessageBinaryDetachedResult>;
async function encryptMessage(
	options: EncryptMessageOptions,
): Promise<
	| EncryptMessageArmoredResult
	| EncryptMessageBinaryResult
	| EncryptMessageArmoredDetachedResult
	| EncryptMessageBinaryDetachedResult
> {
	const message = await openpgp.createMessage({
		binary: new Uint8Array(options.binaryData),
	});
	const format = options.format ?? "armored";
	const encryptionKeys = unwrapPublicKeys(options.encryptionKeys);
	const sessionKey = options.sessionKey ? unwrapSessionKey(options.sessionKey) : undefined;
	const signingKeys = options.signingKeys ? unwrapPrivateKeys(options.signingKeys) : undefined;

	if (options.detached) {
		const requiredSigningKeys = unwrapPrivateKeys(requireSigningKeys(options.signingKeys));
		if (format === "binary") {
			const encryptedMessage = await openpgp.encrypt({
				message,
				encryptionKeys,
				sessionKey,
				format: "binary",
			});
			const signature = await openpgp.sign({
				message,
				signingKeys: requiredSigningKeys,
				detached: true,
				format: "binary",
			});
			return { message: encryptedMessage, signature };
		}
		const encryptedMessage = await openpgp.encrypt({
			message,
			encryptionKeys,
			sessionKey,
			format: "armored",
		});
		const signature = await openpgp.sign({
			message,
			signingKeys: requiredSigningKeys,
			detached: true,
			format: "armored",
		});
		return { message: encryptedMessage, signature };
	}

	const config = buildCompressionConfig(options.compress);
	const encryptedMessage =
		format === "binary"
			? await openpgp.encrypt({
					message,
					encryptionKeys,
					signingKeys,
					sessionKey,
					format: "binary",
					config,
				})
			: await openpgp.encrypt({
					message,
					encryptionKeys,
					signingKeys,
					sessionKey,
					format: "armored",
					config,
				});

	return { message: encryptedMessage };
}

export function createOpenPGPCryptoProxy(): OpenPGPCryptoProxy {
	return {
		async generateKey(options) {
			const { privateKey } = await openpgp.generateKey({
				type: "ecc",
				curve: options.curve,
				userIDs: options.userIDs.map((user) => ({ name: user.name })),
				format: "object",
			});
			return wrapPrivateKey(privateKey);
		},

		async exportPrivateKey(options) {
			const rawKey = unwrapPrivateKey(options.privateKey);
			if (options.passphrase === null) {
				return rawKey.armor();
			}
			const encryptedKey = await openpgp.encryptKey({
				privateKey: rawKey,
				passphrase: options.passphrase,
			});
			return encryptedKey.armor();
		},

		async importPrivateKey(options) {
			const privateKey = await openpgp.readPrivateKey({
				armoredKey: options.armoredKey,
			});
			if (options.passphrase === null) {
				return wrapPrivateKey(privateKey);
			}
			const decryptedKey = await openpgp.decryptKey({
				privateKey,
				passphrase: options.passphrase,
			});
			return wrapPrivateKey(decryptedKey);
		},

		async generateSessionKey(options) {
			const sessionKey = await openpgp.generateSessionKey({
				encryptionKeys: unwrapPublicKeys(options.recipientKeys),
			});
			return wrapSessionKey(sessionKey);
		},

		async encryptSessionKey(options) {
			const sessionKey = unwrapSessionKey(options);
			const encryptionKeys = options.encryptionKeys
				? unwrapPublicKeys(options.encryptionKeys)
				: undefined;
			const keyPacket = await openpgp.encryptSessionKey({
				data: sessionKey.data,
				algorithm: sessionKey.algorithm,
				encryptionKeys,
				passwords: options.passwords,
				format: "binary",
			});
			return toStrictUint8Array(keyPacket);
		},

		async decryptSessionKey(options) {
			const message = options.armoredMessage
				? await openpgp.readMessage({
						armoredMessage: options.armoredMessage,
					})
				: await openpgp.readMessage({
						binaryMessage: options.binaryMessage ?? new Uint8Array(),
					});
			const decryptedKeys = await openpgp.decryptSessionKeys({
				message,
				decryptionKeys: unwrapPrivateKeys(options.decryptionKeys),
			});
			const sessionKey = decryptedKeys[0];
			if (!sessionKey || sessionKey.algorithm === null) {
				return;
			}
			return wrapSessionKey({
				data: sessionKey.data,
				algorithm: sessionKey.algorithm,
			});
		},

		encryptMessage,

		async decryptMessage(options) {
			const message = options.armoredMessage
				? await openpgp.readMessage({
						armoredMessage: options.armoredMessage,
					})
				: await openpgp.readMessage({
						binaryMessage: options.binaryMessage ?? new Uint8Array(),
					});
			const signature = options.armoredSignature
				? await openpgp.readSignature({
						armoredSignature: options.armoredSignature,
					})
				: options.binarySignature
					? await openpgp.readSignature({
							binarySignature: options.binarySignature,
						})
					: undefined;

			const result = await openpgp.decrypt({
				message,
				decryptionKeys: options.decryptionKeys
					? unwrapPrivateKeys(options.decryptionKeys)
					: undefined,
				passwords: options.passwords,
				sessionKeys: options.sessionKeys
					? unwrapSessionKey(options.sessionKeys)
					: undefined,
				verificationKeys: options.verificationKeys
					? unwrapPublicKeys(options.verificationKeys)
					: undefined,
				signature,
				format: options.format ?? "utf8",
			});

			const signatureResult = result.signatures?.[0];
			const verified = signatureResult
				? await signatureResult.verified.catch(() => false)
				: undefined;

			return {
				data: result.data,
				verificationStatus:
					verified === undefined
						? VERIFICATION_NOT_SIGNED
						: toVerificationStatus(verified),
				verificationErrors: undefined,
			};
		},

		async signMessage(options) {
			const message = await openpgp.createMessage({
				binary: new Uint8Array(options.binaryData),
			});
			const signature =
				options.format === "binary"
					? await openpgp.sign({
							message,
							signingKeys: unwrapPrivateKeys(options.signingKeys),
							detached: options.detached,
							format: "binary",
						})
					: await openpgp.sign({
							message,
							signingKeys: unwrapPrivateKeys(options.signingKeys),
							detached: options.detached,
							format: "armored",
						});
			return signature;
		},

		async verifyMessage(options) {
			const message = await openpgp.createMessage({
				binary: new Uint8Array(options.binaryData),
			});
			const signature = options.armoredSignature
				? await openpgp.readSignature({
						armoredSignature: options.armoredSignature,
					})
				: await openpgp.readSignature({
						binarySignature: options.binarySignature ?? new Uint8Array(),
					});

			const result = await openpgp.verify({
				message,
				signature,
				verificationKeys: unwrapPublicKeys(options.verificationKeys),
			});
			const signatureResult = result.signatures[0];
			const verified = signatureResult
				? await signatureResult.verified.catch(() => false)
				: false;

			return {
				verificationStatus: toVerificationStatus(verified),
				errors: undefined,
			};
		},
	};
}
