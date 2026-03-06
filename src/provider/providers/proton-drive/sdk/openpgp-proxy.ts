import * as openpgp from "openpgp";
import type {
	PrivateKey as DrivePrivateKey,
	PublicKey as DrivePublicKey,
	SessionKey as DriveSessionKey,
	VERIFICATION_STATUS as VerificationStatus,
} from "@protontech/drive-sdk/dist/crypto/interface";
import type { OpenPGPCryptoProxy } from "@protontech/drive-sdk";
import { VERIFICATION_STATUS } from "@protontech/drive-sdk/dist/crypto/interface";

type EncryptMessageOptions = {
	format?: "armored" | "binary";
	binaryData: Uint8Array;
	sessionKey?: DriveSessionKey;
	encryptionKeys: DrivePublicKey[];
	signingKeys?: DrivePrivateKey;
	detached?: boolean;
	compress?: boolean;
};

type EncryptMessageArmoredResult = { message: string };
type EncryptMessageBinaryResult = { message: Uint8Array };
type EncryptMessageArmoredDetachedResult = {
	message: string;
	signature: string;
};
type EncryptMessageBinaryDetachedResult = {
	message: Uint8Array;
	signature: Uint8Array;
};

const sessionKeyStore = new WeakMap<DriveSessionKey, openpgp.SessionKey>();
const SESSION_KEY_ALGORITHM_FIELD = "__openpgpAlgorithm";

type SessionKeyWithMetadata = DriveSessionKey & {
	[SESSION_KEY_ALGORITHM_FIELD]?: openpgp.enums.symmetricNames;
};

export function wrapPublicKey(key: openpgp.PublicKey): DrivePublicKey {
	const wrapped: DrivePublicKey = { _idx: key };
	return wrapped;
}

export function wrapPrivateKey(key: openpgp.PrivateKey): DrivePrivateKey {
	const wrapped: DrivePrivateKey = { _idx: key, _dummyType: "private" };
	return wrapped;
}

function unwrapPublicKey(key: DrivePublicKey): openpgp.PublicKey {
	const raw = key._idx;
	if (!raw || typeof raw !== "object") {
		throw new Error("Invalid OpenPGP public key.");
	}
	return raw as openpgp.PublicKey;
}

function unwrapPrivateKey(key: DrivePrivateKey): openpgp.PrivateKey {
	const raw = key._idx;
	if (!raw || typeof raw !== "object") {
		throw new Error("Invalid OpenPGP private key.");
	}
	return raw as openpgp.PrivateKey;
}

function unwrapPrivateKeys(keys: DrivePrivateKey | DrivePrivateKey[]): openpgp.PrivateKey[] {
	return (Array.isArray(keys) ? keys : [keys]).map(unwrapPrivateKey);
}

function unwrapPublicKeys(keys: DrivePublicKey | DrivePublicKey[]): openpgp.PublicKey[] {
	return (Array.isArray(keys) ? keys : [keys]).map(unwrapPublicKey);
}

function wrapSessionKey(key: openpgp.SessionKey): DriveSessionKey {
	const sessionKey: SessionKeyWithMetadata = {
		data: key.data,
		[SESSION_KEY_ALGORITHM_FIELD]: key.algorithm,
	};
	sessionKeyStore.set(sessionKey, key);
	return sessionKey;
}

function unwrapSessionKey(key: DriveSessionKey): openpgp.SessionKey {
	const stored = sessionKeyStore.get(key);
	if (!stored) {
		const withMetadata = key as SessionKeyWithMetadata;
		const algorithm =
			withMetadata[SESSION_KEY_ALGORITHM_FIELD] ??
			inferSessionKeyAlgorithm(withMetadata.data);
		if (withMetadata.data && algorithm) {
			return {
				data: withMetadata.data,
				algorithm,
			};
		}
		throw new Error("Session key is missing OpenPGP metadata.");
	}
	return stored;
}

function inferSessionKeyAlgorithm(data?: Uint8Array): openpgp.enums.symmetricNames | undefined {
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
	return verified ? VERIFICATION_STATUS.SIGNED_AND_VALID : VERIFICATION_STATUS.SIGNED_AND_INVALID;
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
			return keyPacket;
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
				return undefined;
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
						? VERIFICATION_STATUS.NOT_SIGNED
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
