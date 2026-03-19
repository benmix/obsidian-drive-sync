import type { PrivateKey, PublicKey, SessionKey } from "openpgp";

export type { SessionKey };

export interface OpenPGPCryptoInterface {
	generatePassphrase(): string;
	generateSessionKey(encryptionKeys: PrivateKey[]): Promise<SessionKey>;
	encryptSessionKey(
		sessionKey: SessionKey,
		encryptionKeys: PublicKey | PublicKey[],
	): Promise<{ keyPacket: Uint8Array }>;
	encryptSessionKeyWithPassword(
		sessionKey: SessionKey,
		password: string,
	): Promise<{ keyPacket: Uint8Array }>;
	generateKey(passphrase: string): Promise<{ privateKey: PrivateKey; armoredKey: string }>;
	encryptArmored(
		data: Uint8Array,
		encryptionKeys: PrivateKey[],
		sessionKey?: SessionKey,
	): Promise<{ armoredData: string }>;
	encryptAndSign(
		data: Uint8Array,
		sessionKey: SessionKey,
		encryptionKeys: PrivateKey[],
		signingKey: PrivateKey,
	): Promise<{ encryptedData: Uint8Array }>;
	encryptAndSignArmored(
		data: Uint8Array,
		sessionKey: SessionKey | undefined,
		encryptionKeys: PrivateKey[],
		signingKey: PrivateKey,
	): Promise<{ armoredData: string }>;
	encryptAndSignDetached(
		data: Uint8Array,
		sessionKey: SessionKey,
		encryptionKeys: PrivateKey[],
		signingKey: PrivateKey,
	): Promise<{ encryptedData: Uint8Array; signature: Uint8Array }>;
	encryptAndSignDetachedArmored(
		data: Uint8Array,
		sessionKey: SessionKey,
		encryptionKeys: PrivateKey[],
		signingKey: PrivateKey,
	): Promise<{ armoredData: string; armoredSignature: string }>;
	sign(
		data: Uint8Array,
		signingKey: PrivateKey,
		signatureContext?: string,
	): Promise<{ signature: Uint8Array }>;
	signArmored(
		data: Uint8Array,
		signingKey: PrivateKey | PrivateKey[],
	): Promise<{ signature: string }>;
	verify(
		data: Uint8Array,
		signature: Uint8Array,
		verificationKeys: PublicKey | PublicKey[],
	): Promise<{ verified: number; verificationErrors?: Error[] }>;
	verifyArmored(
		data: Uint8Array,
		armoredSignature: string,
		verificationKeys: PublicKey | PublicKey[],
		signatureContext?: string,
	): Promise<{ verified: number; verificationErrors?: Error[] }>;
	decryptSessionKey(
		data: Uint8Array,
		decryptionKeys: PrivateKey | PrivateKey[],
	): Promise<SessionKey>;
	decryptArmoredSessionKey(
		armoredData: string,
		decryptionKeys: PrivateKey | PrivateKey[],
	): Promise<SessionKey>;
	decryptKey(armoredKey: string, passphrase: string): Promise<PrivateKey>;
	decryptAndVerify(
		data: Uint8Array,
		sessionKey: SessionKey,
		verificationKeys: PublicKey | PublicKey[],
	): Promise<{ data: Uint8Array; verified: number }>;
	decryptAndVerifyDetached(
		data: Uint8Array,
		signature: Uint8Array | undefined,
		sessionKey: SessionKey,
		verificationKeys?: PublicKey | PublicKey[],
	): Promise<{ data: Uint8Array; verified: number }>;
	decryptArmored(
		armoredData: string,
		decryptionKeys: PrivateKey | PrivateKey[],
	): Promise<Uint8Array>;
	decryptArmoredAndVerify(
		armoredData: string,
		decryptionKeys: PrivateKey | PrivateKey[],
		verificationKeys: PublicKey | PublicKey[],
	): Promise<{ data: Uint8Array; verified: number }>;
	decryptArmoredAndVerifyDetached(
		armoredData: string,
		armoredSignature: string | undefined,
		sessionKey: SessionKey,
		verificationKeys: PublicKey | PublicKey[],
	): Promise<{ data: Uint8Array; verified: number }>;
	decryptArmoredWithPassword(armoredData: string, password: string): Promise<Uint8Array>;
}
