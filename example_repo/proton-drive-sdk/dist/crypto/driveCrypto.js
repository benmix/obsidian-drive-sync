"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arrayToHexString = exports.DriveCrypto = void 0;
exports.uint8ArrayToUtf8 = uint8ArrayToUtf8;
const utils_1 = require("./utils");
// TODO: Switch to CryptoProxy module once available.
const hmac_1 = require("./hmac");
var SIGNING_CONTEXTS;
(function (SIGNING_CONTEXTS) {
    SIGNING_CONTEXTS["SHARING_INVITER"] = "drive.share-member.inviter";
    SIGNING_CONTEXTS["SHARING_INVITER_EXTERNAL_INVITATION"] = "drive.share-member.external-invitation";
    SIGNING_CONTEXTS["SHARING_MEMBER"] = "drive.share-member.member";
})(SIGNING_CONTEXTS || (SIGNING_CONTEXTS = {}));
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
class DriveCrypto {
    openPGPCrypto;
    srpModule;
    constructor(openPGPCrypto, srpModule) {
        this.openPGPCrypto = openPGPCrypto;
        this.srpModule = srpModule;
        this.openPGPCrypto = openPGPCrypto;
        this.srpModule = srpModule;
    }
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
    async generateKey(encryptionKeys, signingKey) {
        const passphrase = this.openPGPCrypto.generatePassphrase();
        const [{ privateKey, armoredKey }, passphraseSessionKey] = await Promise.all([
            this.openPGPCrypto.generateKey(passphrase),
            this.openPGPCrypto.generateSessionKey(encryptionKeys),
        ]);
        const { armoredPassphrase, armoredPassphraseSignature } = await this.encryptPassphrase(passphrase, passphraseSessionKey, encryptionKeys, signingKey);
        return {
            encrypted: {
                armoredKey,
                armoredPassphrase,
                armoredPassphraseSignature,
            },
            decrypted: {
                passphrase,
                key: privateKey,
                passphraseSessionKey,
            },
        };
    }
    /**
     * It generates content key from node key for encrypting file blocks.
     *
     * @param encryptionKey - Its own node key.
     * @returns Object with serialised key packet and decrypted session key.
     */
    async generateContentKey(encryptionKey) {
        const contentKeyPacketSessionKey = await this.openPGPCrypto.generateSessionKey([encryptionKey]);
        const { signature: armoredContentKeyPacketSignature } = await this.openPGPCrypto.signArmored(contentKeyPacketSessionKey.data, [encryptionKey]);
        const { keyPacket } = await this.openPGPCrypto.encryptSessionKey(contentKeyPacketSessionKey, [encryptionKey]);
        return {
            encrypted: {
                base64ContentKeyPacket: (0, utils_1.uint8ArrayToBase64String)(keyPacket),
                armoredContentKeyPacketSignature,
            },
            decrypted: {
                contentKeyPacketSessionKey,
            },
        };
    }
    /**
     * It encrypts passphrase with provided session and encryption keys.
     * This should be used only for re-encrypting the passphrase with
     * different key (e.g., moving the node to different parent).
     *
     * @returns Object with armored passphrase and passphrase signature.
     */
    async encryptPassphrase(passphrase, sessionKey, encryptionKeys, signingKey) {
        const { armoredData: armoredPassphrase, armoredSignature: armoredPassphraseSignature } = await this.openPGPCrypto.encryptAndSignDetachedArmored(new TextEncoder().encode(passphrase), sessionKey, encryptionKeys, signingKey);
        return {
            armoredPassphrase,
            armoredPassphraseSignature,
        };
    }
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
    async decryptKey(armoredKey, armoredPassphrase, armoredPassphraseSignature, decryptionKeys, verificationKeys) {
        const passphraseSessionKey = await this.openPGPCrypto.decryptArmoredSessionKey(armoredPassphrase, decryptionKeys);
        const { data: decryptedPassphrase, verified, verificationErrors, } = await this.openPGPCrypto.decryptArmoredAndVerifyDetached(armoredPassphrase, armoredPassphraseSignature, passphraseSessionKey, verificationKeys);
        const passphrase = uint8ArrayToUtf8(decryptedPassphrase);
        const key = await this.openPGPCrypto.decryptKey(armoredKey, passphrase);
        return {
            passphrase,
            key,
            passphraseSessionKey,
            verified,
            verificationErrors,
        };
    }
    /**
     * It encrypts session key with provided encryption key.
     */
    async encryptSessionKey(sessionKey, encryptionKey) {
        const { keyPacket } = await this.openPGPCrypto.encryptSessionKey(sessionKey, [encryptionKey]);
        return {
            base64KeyPacket: (0, utils_1.uint8ArrayToBase64String)(keyPacket),
        };
    }
    /**
     * It encrypts password with provided address key that can be used to
     * manage the public link, encrypts share passphrase session key using
     * provided bcrypt passphrase and generates SRP verifier.
     */
    async encryptPublicLinkPasswordAndSessionKey(password, addressKey, bcryptPassphrase, sharePassphraseSessionKey) {
        const [{ armoredData: armoredPassword }, { keyPacket }, srp] = await Promise.all([
            this.openPGPCrypto.encryptArmored(new TextEncoder().encode(password), [addressKey]),
            this.openPGPCrypto.encryptSessionKeyWithPassword(sharePassphraseSessionKey, bcryptPassphrase),
            this.srpModule.getSrpVerifier(password),
        ]);
        return {
            armoredPassword,
            base64SharePassphraseKeyPacket: (0, utils_1.uint8ArrayToBase64String)(keyPacket),
            srp,
        };
    }
    /**
     * It decrypts the key using the password via SRP protocol.
     *
     * The function follows the same functionality as `decryptKey` but uses SRP
     * protocol to decrypt the passphrase of the key. It is used for saved
     * public links where user saved the link with password and is not direct
     * member of the share.
     */
    async decryptKeyWithSrpPassword(password, salt, armoredKey, armoredPassphrase) {
        const keyPassword = await this.srpModule.computeKeyPassword(password, salt);
        const passphrase = await this.openPGPCrypto.decryptArmoredWithPassword(armoredPassphrase, keyPassword);
        const key = await this.openPGPCrypto.decryptKey(armoredKey, new TextDecoder().decode(passphrase));
        return {
            key,
        };
    }
    /**
     * It decrypts session key from armored data.
     *
     * `decryptionKeys` are used to decrypt the session key from the `armoredData`.
     */
    async decryptSessionKey(armoredData, decryptionKeys) {
        const sessionKey = await this.openPGPCrypto.decryptArmoredSessionKey(armoredData, decryptionKeys);
        return sessionKey;
    }
    async decryptAndVerifySessionKey(base64data, armoredSignature, decryptionKeys, verificationKeys) {
        const data = (0, utils_1.base64StringToUint8Array)(base64data);
        const sessionKey = await this.openPGPCrypto.decryptSessionKey(data, decryptionKeys);
        let verified;
        let verificationErrors;
        if (armoredSignature) {
            const result = await this.openPGPCrypto.verifyArmored(sessionKey.data, armoredSignature, verificationKeys);
            verified = result.verified;
            verificationErrors = result.verificationErrors;
        }
        return {
            sessionKey,
            verified,
            verificationErrors,
        };
    }
    /**
     * It decrypts key similarly like `decryptKey`, but without signature
     * verification. This is used for invitations.
     */
    async decryptUnsignedKey(armoredKey, armoredPassphrase, decryptionKeys) {
        const { data: decryptedPassphrase } = await this.openPGPCrypto.decryptArmoredAndVerify(armoredPassphrase, decryptionKeys, []);
        const passphrase = uint8ArrayToUtf8(decryptedPassphrase);
        const key = await this.openPGPCrypto.decryptKey(armoredKey, passphrase);
        return key;
    }
    /**
     * It encrypts and armors signature with provided session and encryption keys.
     */
    async encryptSignature(signature, encryptionKey, sessionKey) {
        const { armoredData: armoredSignature } = await this.openPGPCrypto.encryptArmored(signature, [encryptionKey], sessionKey);
        return {
            armoredSignature,
        };
    }
    /**
     * It generates random 32 bytes that are encrypted and signed with
     * the provided key.
     */
    async generateHashKey(encryptionAndSigningKey) {
        // Once all clients can use non-ascii bytes, switch to simple
        // generating of random bytes without encoding it into base64:
        //const passphrase crypto.getRandomValues(new Uint8Array(32));
        const passphrase = this.openPGPCrypto.generatePassphrase();
        const hashKey = new TextEncoder().encode(passphrase);
        const { armoredData: armoredHashKey } = await this.openPGPCrypto.encryptAndSignArmored(hashKey, undefined, [encryptionAndSigningKey], encryptionAndSigningKey);
        return {
            armoredHashKey,
            hashKey,
        };
    }
    async generateLookupHash(newName, parentHashKey) {
        const key = await (0, hmac_1.importHmacKey)(parentHashKey);
        const signature = await (0, hmac_1.computeHmacSignature)(key, new TextEncoder().encode(newName));
        return (0, exports.arrayToHexString)(signature);
    }
    /**
     * It converts node name into bytes array and encrypts and signs
     * with provided keys.
     *
     * The function accepts either encryption or session key. Use encryption
     * key if you want to encrypt the name for the new node. Use session key
     * if you want to encrypt the new name for the existing node.
     */
    async encryptNodeName(nodeName, sessionKey, encryptionKey, signingKey) {
        if (!sessionKey && !encryptionKey) {
            throw new Error('Neither session nor encryption key provided for encrypting node name');
        }
        const { armoredData: armoredNodeName } = await this.openPGPCrypto.encryptAndSignArmored(new TextEncoder().encode(nodeName), sessionKey, encryptionKey ? [encryptionKey] : [], signingKey);
        return {
            armoredNodeName,
        };
    }
    /**
     * It decrypts armored node name and verifies embeded signature.
     *
     * Note: The function doesn't throw in case of verification issue.
     * You have to read `verified` result and act based on that.
     */
    async decryptNodeName(armoredNodeName, decryptionKey, verificationKeys) {
        const { data: name, verified, verificationErrors, } = await this.openPGPCrypto.decryptArmoredAndVerify(armoredNodeName, [decryptionKey], verificationKeys);
        return {
            name: uint8ArrayToUtf8(name),
            verified,
            verificationErrors,
        };
    }
    /**
     * It decrypts armored node hash key and verifies embeded signature.
     *
     * Note: The function doesn't throw in case of verification issue.
     * You have to read `verified` result and act based on that.
     */
    async decryptNodeHashKey(armoredHashKey, decryptionAndVerificationKey, extraVerificationKeys) {
        // In the past, we had misunderstanding what key is used to sign hash
        // key. Originally, it meant to be the node key, which web used for all
        // nodes besides the root one, where address key was used instead.
        // Similarly, iOS or Android used address key for all nodes. Latest
        // versions should use node key in all cases, but we accept also
        // address key. Its still signed with a valid key.
        const { data: hashKey, verified, verificationErrors, } = await this.openPGPCrypto.decryptArmoredAndVerify(armoredHashKey, [decryptionAndVerificationKey], [decryptionAndVerificationKey, ...extraVerificationKeys]);
        return {
            hashKey,
            verified,
            verificationErrors,
        };
    }
    async encryptExtendedAttributes(extendedAttributes, encryptionKey, signingKey) {
        const { armoredData: armoredExtendedAttributes } = await this.openPGPCrypto.encryptAndSignArmored(new TextEncoder().encode(extendedAttributes), undefined, [encryptionKey], signingKey, { compress: true });
        return {
            armoredExtendedAttributes,
        };
    }
    async decryptExtendedAttributes(armoreExtendedAttributes, decryptionKey, verificationKeys) {
        const { data: decryptedExtendedAttributes, verified, verificationErrors, } = await this.openPGPCrypto.decryptArmoredAndVerify(armoreExtendedAttributes, [decryptionKey], verificationKeys);
        return {
            extendedAttributes: uint8ArrayToUtf8(decryptedExtendedAttributes),
            verified,
            verificationErrors,
        };
    }
    async encryptInvitation(shareSessionKey, encryptionKey, signingKey) {
        const { keyPacket } = await this.openPGPCrypto.encryptSessionKey(shareSessionKey, encryptionKey);
        const { signature: keyPacketSignature } = await this.openPGPCrypto.sign(keyPacket, signingKey, SIGNING_CONTEXTS.SHARING_INVITER);
        return {
            base64KeyPacket: (0, utils_1.uint8ArrayToBase64String)(keyPacket),
            base64KeyPacketSignature: (0, utils_1.uint8ArrayToBase64String)(keyPacketSignature),
        };
    }
    async verifyInvitation(base64KeyPacket, armoredKeyPacketSignature, verificationKeys) {
        const { verified, verificationErrors } = await this.openPGPCrypto.verifyArmored((0, utils_1.base64StringToUint8Array)(base64KeyPacket), armoredKeyPacketSignature, verificationKeys, SIGNING_CONTEXTS.SHARING_INVITER);
        return { verified, verificationErrors };
    }
    async acceptInvitation(base64KeyPacket, signingKey) {
        const sessionKey = await this.openPGPCrypto.decryptSessionKey((0, utils_1.base64StringToUint8Array)(base64KeyPacket), signingKey);
        const { signature } = await this.openPGPCrypto.sign(sessionKey.data, signingKey, SIGNING_CONTEXTS.SHARING_MEMBER);
        return {
            base64SessionKeySignature: (0, utils_1.uint8ArrayToBase64String)(signature),
        };
    }
    async encryptExternalInvitation(shareSessionKey, signingKey, inviteeEmail) {
        const data = inviteeEmail.concat('|').concat((0, utils_1.uint8ArrayToBase64String)(shareSessionKey.data));
        const { signature: externalInviationSignature } = await this.openPGPCrypto.sign(new TextEncoder().encode(data), signingKey, SIGNING_CONTEXTS.SHARING_INVITER_EXTERNAL_INVITATION);
        return {
            base64ExternalInvitationSignature: (0, utils_1.uint8ArrayToBase64String)(externalInviationSignature),
        };
    }
    async encryptThumbnailBlock(thumbnailData, sessionKey, signingKey) {
        const { encryptedData } = await this.openPGPCrypto.encryptAndSign(thumbnailData, sessionKey, [], // Thumbnails use the session key so we do not send encryption key.
        signingKey);
        return {
            encryptedData,
        };
    }
    async decryptThumbnailBlock(encryptedThumbnail, sessionKey, verificationKeys) {
        const { data: decryptedThumbnail, verified, verificationErrors, } = await this.openPGPCrypto.decryptAndVerify(encryptedThumbnail, sessionKey, verificationKeys);
        return {
            decryptedThumbnail,
            verified,
            verificationErrors,
        };
    }
    async encryptBlock(blockData, encryptionKey, sessionKey, signingKey) {
        const { encryptedData, signature } = await this.openPGPCrypto.encryptAndSignDetached(blockData, sessionKey, [], // Blocks use the session key so we do not send encryption key.
        signingKey);
        const { armoredSignature } = await this.encryptSignature(signature, encryptionKey, sessionKey);
        return {
            encryptedData,
            armoredSignature,
        };
    }
    async decryptBlock(encryptedBlock, sessionKey) {
        const { data: decryptedBlock } = await this.openPGPCrypto.decryptAndVerify(encryptedBlock, sessionKey, []);
        return decryptedBlock;
    }
    async signManifest(manifest, signingKey) {
        const { signature: armoredManifestSignature } = await this.openPGPCrypto.signArmored(manifest, signingKey);
        return {
            armoredManifestSignature,
        };
    }
    async verifyManifest(manifest, armoredSignature, verificationKeys) {
        const { verified, verificationErrors } = await this.openPGPCrypto.verifyArmored(manifest, armoredSignature, verificationKeys);
        return {
            verified,
            verificationErrors,
        };
    }
    async decryptShareUrlPassword(armoredPassword, decryptionKeys) {
        const password = await this.openPGPCrypto.decryptArmored(armoredPassword, decryptionKeys);
        return uint8ArrayToUtf8(password);
    }
}
exports.DriveCrypto = DriveCrypto;
function uint8ArrayToUtf8(input) {
    return new TextDecoder('utf-8', { fatal: true }).decode(input);
}
/**
 * Convert an array of 8-bit integers to a hex string
 * @param bytes - Array of 8-bit integers to convert
 * @returns Hexadecimal representation of the array
 */
const arrayToHexString = (bytes) => {
    const hexAlphabet = '0123456789abcdef';
    let s = '';
    bytes.forEach((v) => {
        s += hexAlphabet[v >> 4] + hexAlphabet[v & 15];
    });
    return s;
};
exports.arrayToHexString = arrayToHexString;
//# sourceMappingURL=driveCrypto.js.map