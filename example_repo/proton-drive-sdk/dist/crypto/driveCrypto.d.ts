import { OpenPGPCrypto, PrivateKey, PublicKey, SessionKey, SRPModule, SRPVerifier, VERIFICATION_STATUS } from './interface';
/**
 * Drive crypto layer to provide general operations for Drive crypto.
 *
 * This layer focuses on providing general Drive crypto functions. Only
 * high-level functions that are required on multiple places should be
 * peresent. E.g., no specific implementation how keys are encrypted,
 * but we do share same key generation across shares and nodes modules,
 * for example, which we can generelise here and in each module just
 * call with specific arguments.
 */
export declare class DriveCrypto {
    private openPGPCrypto;
    private srpModule;
    constructor(openPGPCrypto: OpenPGPCrypto, srpModule: SRPModule);
    /**
     * It generates passphrase and key that is encrypted with the
     * generated passphrase.
     *
     * `encrpytionKeys` are used to generate session key, which is
     * also used to encrypt the passphrase. The encrypted passphrase
     * is signed with `signingKey`.
     *
     * @returns Object with:
     *  - encrypted (armored) data (key, passphrase and passphrase
     *    signature) for sending to the server
     *  - decrypted data (key, sessionKey) for crypto usage
     */
    generateKey(encryptionKeys: PrivateKey[], signingKey: PrivateKey): Promise<{
        encrypted: {
            armoredKey: string;
            armoredPassphrase: string;
            armoredPassphraseSignature: string;
        };
        decrypted: {
            passphrase: string;
            key: PrivateKey;
            passphraseSessionKey: SessionKey;
        };
    }>;
    /**
     * It generates content key from node key for encrypting file blocks.
     *
     * @param encryptionKey - Its own node key.
     * @returns Object with serialised key packet and decrypted session key.
     */
    generateContentKey(encryptionKey: PrivateKey): Promise<{
        encrypted: {
            base64ContentKeyPacket: string;
            armoredContentKeyPacketSignature: string;
        };
        decrypted: {
            contentKeyPacketSessionKey: SessionKey;
        };
    }>;
    /**
     * It encrypts passphrase with provided session and encryption keys.
     * This should be used only for re-encrypting the passphrase with
     * different key (e.g., moving the node to different parent).
     *
     * @returns Object with armored passphrase and passphrase signature.
     */
    encryptPassphrase(passphrase: string, sessionKey: SessionKey, encryptionKeys: PrivateKey[], signingKey: PrivateKey): Promise<{
        armoredPassphrase: string;
        armoredPassphraseSignature: string;
    }>;
    /**
     * It decrypts key generated via `generateKey`.
     *
     * Armored data are passed from the server. `decryptionKeys` are used
     * to decrypt the session key from the `armoredPassphrase`. Then the
     * session key is used with `verificationKeys` to decrypt and verify
     * the passphrase. Finally, the armored key is decrypted.
     *
     * Note: The function doesn't throw in case of verification issue.
     * You have to read `verified` result and act based on that.
     *
     * @returns key and sessionKey for crypto usage, and verification status
     */
    decryptKey(armoredKey: string, armoredPassphrase: string, armoredPassphraseSignature: string | undefined, decryptionKeys: PrivateKey[], verificationKeys: PublicKey[]): Promise<{
        passphrase: string;
        key: PrivateKey;
        passphraseSessionKey: SessionKey;
        verified: VERIFICATION_STATUS;
        verificationErrors?: Error[];
    }>;
    /**
     * It encrypts session key with provided encryption key.
     */
    encryptSessionKey(sessionKey: SessionKey, encryptionKey: PublicKey): Promise<{
        base64KeyPacket: string;
    }>;
    /**
     * It encrypts password with provided address key that can be used to
     * manage the public link, encrypts share passphrase session key using
     * provided bcrypt passphrase and generates SRP verifier.
     */
    encryptPublicLinkPasswordAndSessionKey(password: string, addressKey: PrivateKey, bcryptPassphrase: string, sharePassphraseSessionKey: SessionKey): Promise<{
        armoredPassword: string;
        base64SharePassphraseKeyPacket: string;
        srp: SRPVerifier;
    }>;
    /**
     * It decrypts the key using the password via SRP protocol.
     *
     * The function follows the same functionality as `decryptKey` but uses SRP
     * protocol to decrypt the passphrase of the key. It is used for saved
     * public links where user saved the link with password and is not direct
     * member of the share.
     */
    decryptKeyWithSrpPassword(password: string, salt: string, armoredKey: string, armoredPassphrase: string): Promise<{
        key: PrivateKey;
    }>;
    /**
     * It decrypts session key from armored data.
     *
     * `decryptionKeys` are used to decrypt the session key from the `armoredData`.
     */
    decryptSessionKey(armoredData: string, decryptionKeys: PrivateKey | PrivateKey[]): Promise<SessionKey>;
    decryptAndVerifySessionKey(base64data: string, armoredSignature: string | undefined, decryptionKeys: PrivateKey | PrivateKey[], verificationKeys: PublicKey[]): Promise<{
        sessionKey: SessionKey;
        verified?: VERIFICATION_STATUS;
        verificationErrors?: Error[];
    }>;
    /**
     * It decrypts key similarly like `decryptKey`, but without signature
     * verification. This is used for invitations.
     */
    decryptUnsignedKey(armoredKey: string, armoredPassphrase: string, decryptionKeys: PrivateKey | PrivateKey[]): Promise<PrivateKey>;
    /**
     * It encrypts and armors signature with provided session and encryption keys.
     */
    encryptSignature(signature: Uint8Array, encryptionKey: PrivateKey, sessionKey: SessionKey): Promise<{
        armoredSignature: string;
    }>;
    /**
     * It generates random 32 bytes that are encrypted and signed with
     * the provided key.
     */
    generateHashKey(encryptionAndSigningKey: PrivateKey): Promise<{
        armoredHashKey: string;
        hashKey: Uint8Array;
    }>;
    generateLookupHash(newName: string, parentHashKey: Uint8Array): Promise<string>;
    /**
     * It converts node name into bytes array and encrypts and signs
     * with provided keys.
     *
     * The function accepts either encryption or session key. Use encryption
     * key if you want to encrypt the name for the new node. Use session key
     * if you want to encrypt the new name for the existing node.
     */
    encryptNodeName(nodeName: string, sessionKey: SessionKey | undefined, encryptionKey: PrivateKey | undefined, signingKey: PrivateKey): Promise<{
        armoredNodeName: string;
    }>;
    /**
     * It decrypts armored node name and verifies embeded signature.
     *
     * Note: The function doesn't throw in case of verification issue.
     * You have to read `verified` result and act based on that.
     */
    decryptNodeName(armoredNodeName: string, decryptionKey: PrivateKey, verificationKeys: PublicKey[]): Promise<{
        name: string;
        verified: VERIFICATION_STATUS;
        verificationErrors?: Error[];
    }>;
    /**
     * It decrypts armored node hash key and verifies embeded signature.
     *
     * Note: The function doesn't throw in case of verification issue.
     * You have to read `verified` result and act based on that.
     */
    decryptNodeHashKey(armoredHashKey: string, decryptionAndVerificationKey: PrivateKey, extraVerificationKeys: PublicKey[]): Promise<{
        hashKey: Uint8Array;
        verified: VERIFICATION_STATUS;
        verificationErrors?: Error[];
    }>;
    encryptExtendedAttributes(extendedAttributes: string, encryptionKey: PrivateKey, signingKey: PrivateKey): Promise<{
        armoredExtendedAttributes: string;
    }>;
    decryptExtendedAttributes(armoreExtendedAttributes: string, decryptionKey: PrivateKey, verificationKeys: PublicKey[]): Promise<{
        extendedAttributes: string;
        verified: VERIFICATION_STATUS;
        verificationErrors?: Error[];
    }>;
    encryptInvitation(shareSessionKey: SessionKey, encryptionKey: PublicKey, signingKey: PrivateKey): Promise<{
        base64KeyPacket: string;
        base64KeyPacketSignature: string;
    }>;
    verifyInvitation(base64KeyPacket: string, armoredKeyPacketSignature: string, verificationKeys: PublicKey[]): Promise<{
        verified: VERIFICATION_STATUS;
        verificationErrors?: Error[];
    }>;
    acceptInvitation(base64KeyPacket: string, signingKey: PrivateKey): Promise<{
        base64SessionKeySignature: string;
    }>;
    encryptExternalInvitation(shareSessionKey: SessionKey, signingKey: PrivateKey, inviteeEmail: string): Promise<{
        base64ExternalInvitationSignature: string;
    }>;
    encryptThumbnailBlock(thumbnailData: Uint8Array, sessionKey: SessionKey, signingKey: PrivateKey): Promise<{
        encryptedData: Uint8Array;
    }>;
    decryptThumbnailBlock(encryptedThumbnail: Uint8Array, sessionKey: SessionKey, verificationKeys: PublicKey[]): Promise<{
        decryptedThumbnail: Uint8Array;
        verified: VERIFICATION_STATUS;
        verificationErrors?: Error[];
    }>;
    encryptBlock(blockData: Uint8Array, encryptionKey: PrivateKey, sessionKey: SessionKey, signingKey: PrivateKey): Promise<{
        encryptedData: Uint8Array;
        armoredSignature: string;
    }>;
    decryptBlock(encryptedBlock: Uint8Array, sessionKey: SessionKey): Promise<Uint8Array>;
    signManifest(manifest: Uint8Array, signingKey: PrivateKey): Promise<{
        armoredManifestSignature: string;
    }>;
    verifyManifest(manifest: Uint8Array, armoredSignature: string, verificationKeys: PublicKey | PublicKey[]): Promise<{
        verified: VERIFICATION_STATUS;
        verificationErrors?: Error[];
    }>;
    decryptShareUrlPassword(armoredPassword: string, decryptionKeys: PrivateKey[]): Promise<string>;
}
export declare function uint8ArrayToUtf8(input: Uint8Array): string;
/**
 * Convert an array of 8-bit integers to a hex string
 * @param bytes - Array of 8-bit integers to convert
 * @returns Hexadecimal representation of the array
 */
export declare const arrayToHexString: (bytes: Uint8Array) => string;
