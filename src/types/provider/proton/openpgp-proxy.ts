import type { OpenPGPCryptoProxy } from "@protontech/drive-sdk";
import type { SessionKey } from "openpgp";

export type DrivePrivateKey = Awaited<ReturnType<OpenPGPCryptoProxy["generateKey"]>>;
export type DrivePublicKey = Parameters<
	OpenPGPCryptoProxy["generateSessionKey"]
>[0]["recipientKeys"][number];
export type DriveSessionKey = Awaited<ReturnType<OpenPGPCryptoProxy["generateSessionKey"]>>;
export type VerificationStatus = Awaited<
	ReturnType<OpenPGPCryptoProxy["verifyMessage"]>
>["verificationStatus"];

export type EncryptMessageOptions = {
	format?: "armored" | "binary";
	binaryData: Uint8Array;
	sessionKey?: DriveSessionKey;
	encryptionKeys: DrivePublicKey[];
	signingKeys?: DrivePrivateKey;
	detached?: boolean;
	compress?: boolean;
};

export type EncryptMessageArmoredResult = { message: string };
export type EncryptMessageBinaryResult = { message: Uint8Array };
export type EncryptMessageArmoredDetachedResult = {
	message: string;
	signature: string;
};
export type EncryptMessageBinaryDetachedResult = {
	message: Uint8Array;
	signature: Uint8Array;
};

export type SessionKeyWithMetadata = DriveSessionKey & {
	__openpgpAlgorithm?: SessionKey["algorithm"];
};
