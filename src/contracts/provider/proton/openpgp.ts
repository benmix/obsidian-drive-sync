import type * as openpgp from "openpgp";

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
