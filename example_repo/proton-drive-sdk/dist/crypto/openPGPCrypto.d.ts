import { OpenPGPCrypto, PrivateKey, PublicKey, SessionKey, VERIFICATION_STATUS } from './interface';
/**
 * Interface matching CryptoProxy interface from client's monorepo:
 * clients/packages/crypto/lib/proxy/proxy.ts.
 */
export interface OpenPGPCryptoProxy {
    generateKey: (options: {
        userIDs: {
            name: string;
        }[];
        type: 'ecc';
        curve: 'ed25519Legacy';
    }) => Promise<PrivateKey>;
    exportPrivateKey: (options: {
        privateKey: PrivateKey;
        passphrase: string | null;
    }) => Promise<string>;
    importPrivateKey: (options: {
        armoredKey: string;
        passphrase: string | null;
    }) => Promise<PrivateKey>;
    generateSessionKey: (options: {
        recipientKeys: PublicKey[];
    }) => Promise<SessionKey>;
    encryptSessionKey: (options: SessionKey & {
        format: 'binary';
        encryptionKeys?: PublicKey | PublicKey[];
        passwords?: string[];
    }) => Promise<Uint8Array>;
    decryptSessionKey: (options: {
        armoredMessage?: string;
        binaryMessage?: Uint8Array;
        decryptionKeys: PrivateKey | PrivateKey[];
    }) => Promise<SessionKey | undefined>;
    encryptMessage: <Format extends 'armored' | 'binary' = 'armored', Detached extends boolean = false>(options: {
        format?: Format;
        binaryData: Uint8Array;
        sessionKey?: SessionKey;
        encryptionKeys: PublicKey[];
        signingKeys?: PrivateKey;
        detached?: Detached;
        compress?: boolean;
    }) => Promise<Detached extends true ? {
        message: Format extends 'binary' ? Uint8Array : string;
        signature: Format extends 'binary' ? Uint8Array : string;
    } : {
        message: Format extends 'binary' ? Uint8Array : string;
    }>;
    decryptMessage: <Format extends 'utf8' | 'binary' = 'utf8'>(options: {
        format: Format;
        armoredMessage?: string;
        binaryMessage?: Uint8Array;
        armoredSignature?: string;
        binarySignature?: Uint8Array;
        sessionKeys?: SessionKey;
        passwords?: string[];
        decryptionKeys?: PrivateKey | PrivateKey[];
        verificationKeys?: PublicKey | PublicKey[];
    }) => Promise<{
        data: Format extends 'binary' ? Uint8Array : string;
        verified?: VERIFICATION_STATUS;
        verificationStatus?: VERIFICATION_STATUS;
        verificationErrors?: Error[];
    }>;
    signMessage: <Format extends 'binary' | 'armored' = 'armored'>(options: {
        format: Format;
        binaryData: Uint8Array;
        signingKeys: PrivateKey | PrivateKey[];
        detached: boolean;
        signatureContext?: {
            critical: boolean;
            value: string;
        };
    }) => Promise<Format extends 'binary' ? Uint8Array : string>;
    verifyMessage: (options: {
        binaryData: Uint8Array;
        armoredSignature?: string;
        binarySignature?: Uint8Array;
        verificationKeys: PublicKey | PublicKey[];
        signatureContext?: {
            critical: boolean;
            value: string;
        };
    }) => Promise<{
        verified?: VERIFICATION_STATUS;
        verificationStatus?: VERIFICATION_STATUS;
        errors?: Error[];
    }>;
}
/**
 * Implementation of OpenPGPCrypto interface using CryptoProxy from clients
 * monorepo that must be passed as dependency. In the future, CryptoProxy
 * will be published separately and this implementation will use it directly.
 */
export declare class OpenPGPCryptoWithCryptoProxy implements OpenPGPCrypto {
    private cryptoProxy;
    constructor(cryptoProxy: OpenPGPCryptoProxy);
    generatePassphrase(): string;
    generateSessionKey(encryptionKeys: PublicKey[]): Promise<SessionKey>;
    encryptSessionKey(sessionKey: SessionKey, encryptionKeys: PublicKey | PublicKey[]): Promise<{
        keyPacket: Uint8Array;
    }>;
    encryptSessionKeyWithPassword(sessionKey: SessionKey, password: string): Promise<{
        keyPacket: Uint8Array;
    }>;
    generateKey(passphrase: string): Promise<{
        armoredKey: string;
        privateKey: PrivateKey;
    }>;
    encryptArmored(data: Uint8Array, encryptionKeys: PublicKey[], sessionKey?: SessionKey): Promise<{
        armoredData: string;
    }>;
    encryptAndSign(data: Uint8Array, sessionKey: SessionKey, encryptionKeys: PublicKey[], signingKey: PrivateKey): Promise<{
        encryptedData: Uint8Array;
    }>;
    encryptAndSignArmored(data: Uint8Array, sessionKey: SessionKey | undefined, encryptionKeys: PublicKey[], signingKey: PrivateKey, options?: {
        compress?: boolean;
    }): Promise<{
        armoredData: string;
    }>;
    encryptAndSignDetached(data: Uint8Array, sessionKey: SessionKey, encryptionKeys: PublicKey[], signingKey: PrivateKey): Promise<{
        encryptedData: Uint8Array;
        signature: Uint8Array;
    }>;
    encryptAndSignDetachedArmored(data: Uint8Array, sessionKey: SessionKey, encryptionKeys: PublicKey[], signingKey: PrivateKey): Promise<{
        armoredData: string;
        armoredSignature: string;
    }>;
    sign(data: Uint8Array, signingKeys: PrivateKey | PrivateKey[], signatureContext: string): Promise<{
        signature: Uint8Array;
    }>;
    signArmored(data: Uint8Array, signingKeys: PrivateKey | PrivateKey[]): Promise<{
        signature: string;
    }>;
    verify(data: Uint8Array, signature: Uint8Array, verificationKeys: PublicKey | PublicKey[]): Promise<{
        verified: VERIFICATION_STATUS;
        verificationErrors: Error[] | undefined;
    }>;
    verifyArmored(data: Uint8Array, armoredSignature: string, verificationKeys: PublicKey | PublicKey[], signatureContext?: string): Promise<{
        verified: VERIFICATION_STATUS;
        verificationErrors: Error[] | undefined;
    }>;
    decryptSessionKey(data: Uint8Array, decryptionKeys: PrivateKey | PrivateKey[]): Promise<SessionKey>;
    decryptArmoredSessionKey(armoredData: string, decryptionKeys: PrivateKey | PrivateKey[]): Promise<SessionKey>;
    decryptKey(armoredKey: string, passphrase: string): Promise<PrivateKey>;
    decryptAndVerify(data: Uint8Array, sessionKey: SessionKey, verificationKeys: PublicKey[]): Promise<{
        data: Uint8Array;
        verified: VERIFICATION_STATUS;
        verificationErrors: Error[] | undefined;
    }>;
    decryptAndVerifyDetached(data: Uint8Array, signature: Uint8Array | undefined, sessionKey: SessionKey, verificationKeys?: PublicKey[]): Promise<{
        data: Uint8Array;
        verified: VERIFICATION_STATUS;
        verificationErrors: Error[] | undefined;
    }>;
    decryptArmored(armoredData: string, decryptionKeys: PrivateKey | PrivateKey[]): Promise<Uint8Array>;
    decryptArmoredAndVerify(armoredData: string, decryptionKeys: PrivateKey | PrivateKey[], verificationKeys: PublicKey | PublicKey[]): Promise<{
        data: Uint8Array;
        verified: VERIFICATION_STATUS;
        verificationErrors: Error[] | undefined;
    }>;
    decryptArmoredAndVerifyDetached(armoredData: string, armoredSignature: string | undefined, sessionKey: SessionKey, verificationKeys: PublicKey | PublicKey[]): Promise<{
        data: Uint8Array;
        verified: VERIFICATION_STATUS;
        verificationErrors: Error[] | undefined;
    }>;
    decryptArmoredWithPassword(armoredData: string, password: string): Promise<Uint8Array>;
}
