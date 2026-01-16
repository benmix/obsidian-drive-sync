"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenPGPCryptoWithCryptoProxy = void 0;
const ttag_1 = require("ttag");
const utils_1 = require("./utils");
/**
 * Implementation of OpenPGPCrypto interface using CryptoProxy from clients
 * monorepo that must be passed as dependency. In the future, CryptoProxy
 * will be published separately and this implementation will use it directly.
 */
class OpenPGPCryptoWithCryptoProxy {
    cryptoProxy;
    constructor(cryptoProxy) {
        this.cryptoProxy = cryptoProxy;
        this.cryptoProxy = cryptoProxy;
    }
    generatePassphrase() {
        const value = crypto.getRandomValues(new Uint8Array(32));
        // TODO: Once all clients can use non-ascii bytes, switch to simple
        // generating of random bytes without encoding it into base64.
        return (0, utils_1.uint8ArrayToBase64String)(value);
    }
    async generateSessionKey(encryptionKeys) {
        return this.cryptoProxy.generateSessionKey({ recipientKeys: encryptionKeys });
    }
    async encryptSessionKey(sessionKey, encryptionKeys) {
        const keyPacket = await this.cryptoProxy.encryptSessionKey({
            ...sessionKey,
            format: 'binary',
            encryptionKeys,
        });
        return {
            keyPacket,
        };
    }
    async encryptSessionKeyWithPassword(sessionKey, password) {
        const keyPacket = await this.cryptoProxy.encryptSessionKey({
            ...sessionKey,
            format: 'binary',
            passwords: [password],
        });
        return {
            keyPacket,
        };
    }
    async generateKey(passphrase) {
        const privateKey = await this.cryptoProxy.generateKey({
            userIDs: [{ name: 'Drive key' }],
            type: 'ecc',
            curve: 'ed25519Legacy',
        });
        const armoredKey = await this.cryptoProxy.exportPrivateKey({
            privateKey,
            passphrase,
        });
        return {
            armoredKey,
            privateKey,
        };
    }
    async encryptArmored(data, encryptionKeys, sessionKey) {
        const { message: armoredData } = await this.cryptoProxy.encryptMessage({
            binaryData: data,
            sessionKey,
            encryptionKeys,
        });
        return {
            armoredData: armoredData,
        };
    }
    async encryptAndSign(data, sessionKey, encryptionKeys, signingKey) {
        const { message: encryptedData } = await this.cryptoProxy.encryptMessage({
            binaryData: data,
            sessionKey,
            signingKeys: signingKey,
            encryptionKeys,
            format: 'binary',
            detached: false,
        });
        return {
            encryptedData: encryptedData,
        };
    }
    async encryptAndSignArmored(data, sessionKey, encryptionKeys, signingKey, options = {}) {
        const { message: armoredData } = await this.cryptoProxy.encryptMessage({
            binaryData: data,
            encryptionKeys,
            sessionKey,
            signingKeys: signingKey,
            detached: false,
            compress: options.compress || false,
        });
        return {
            armoredData: armoredData,
        };
    }
    async encryptAndSignDetached(data, sessionKey, encryptionKeys, signingKey) {
        const { message: encryptedData, signature } = await this.cryptoProxy.encryptMessage({
            binaryData: data,
            sessionKey,
            signingKeys: signingKey,
            encryptionKeys,
            format: 'binary',
            detached: true,
        });
        return {
            encryptedData: encryptedData,
            signature: signature,
        };
    }
    async encryptAndSignDetachedArmored(data, sessionKey, encryptionKeys, signingKey) {
        const { message: armoredData, signature: armoredSignature } = await this.cryptoProxy.encryptMessage({
            binaryData: data,
            sessionKey,
            signingKeys: signingKey,
            encryptionKeys,
            detached: true,
        });
        return {
            armoredData: armoredData,
            armoredSignature: armoredSignature,
        };
    }
    async sign(data, signingKeys, signatureContext) {
        const signature = await this.cryptoProxy.signMessage({
            binaryData: data,
            signingKeys,
            detached: true,
            format: 'binary',
            signatureContext: { critical: true, value: signatureContext },
        });
        return {
            signature: signature,
        };
    }
    async signArmored(data, signingKeys) {
        const signature = await this.cryptoProxy.signMessage({
            binaryData: data,
            signingKeys,
            detached: true,
            format: 'armored',
        });
        return {
            signature: signature,
        };
    }
    async verify(data, signature, verificationKeys) {
        const { verified, verificationStatus, errors } = await this.cryptoProxy.verifyMessage({
            binaryData: data,
            binarySignature: signature,
            verificationKeys,
        });
        return {
            // pmcrypto 8.3.0 changes `verified` to `verificationStatus`.
            // Proper typing is too complex, it will be removed to support only newer pmcrypto.
            verified: verified || verificationStatus,
            verificationErrors: errors,
        };
    }
    async verifyArmored(data, armoredSignature, verificationKeys, signatureContext) {
        const { verified, verificationStatus, errors } = await this.cryptoProxy.verifyMessage({
            binaryData: data,
            armoredSignature,
            verificationKeys,
            signatureContext: signatureContext ? { critical: true, value: signatureContext } : undefined,
        });
        return {
            // pmcrypto 8.3.0 changes `verified` to `verificationStatus`.
            // Proper typing is too complex, it will be removed to support only newer pmcrypto.
            verified: verified || verificationStatus,
            verificationErrors: errors,
        };
    }
    async decryptSessionKey(data, decryptionKeys) {
        const sessionKey = await this.cryptoProxy.decryptSessionKey({
            binaryMessage: data,
            decryptionKeys,
        });
        if (!sessionKey) {
            throw new Error('Could not decrypt session key');
        }
        return sessionKey;
    }
    async decryptArmoredSessionKey(armoredData, decryptionKeys) {
        const sessionKey = await this.cryptoProxy.decryptSessionKey({
            armoredMessage: armoredData,
            decryptionKeys,
        });
        if (!sessionKey) {
            throw new Error('Could not decrypt session key');
        }
        return sessionKey;
    }
    async decryptKey(armoredKey, passphrase) {
        const key = await this.cryptoProxy.importPrivateKey({
            armoredKey,
            passphrase,
        });
        return key;
    }
    async decryptAndVerify(data, sessionKey, verificationKeys) {
        const { data: decryptedData, verified, verificationStatus, verificationErrors, } = await this.cryptoProxy.decryptMessage({
            binaryMessage: data,
            sessionKeys: sessionKey,
            verificationKeys,
            format: 'binary',
        });
        return {
            data: decryptedData,
            // pmcrypto 8.3.0 changes `verified` to `verificationStatus`.
            // Proper typing is too complex, it will be removed to support only newer pmcrypto.
            verified: verified || verificationStatus,
            verificationErrors,
        };
    }
    async decryptAndVerifyDetached(data, signature, sessionKey, verificationKeys) {
        const { data: decryptedData, verified, verificationStatus, verificationErrors, } = await this.cryptoProxy.decryptMessage({
            binaryMessage: data,
            binarySignature: signature,
            sessionKeys: sessionKey,
            verificationKeys,
            format: 'binary',
        });
        return {
            data: decryptedData,
            // pmcrypto 8.3.0 changes `verified` to `verificationStatus`.
            // Proper typing is too complex, it will be removed to support only newer pmcrypto.
            verified: verified || verificationStatus,
            verificationErrors,
        };
    }
    async decryptArmored(armoredData, decryptionKeys) {
        const { data } = await this.cryptoProxy.decryptMessage({
            armoredMessage: armoredData,
            decryptionKeys,
            format: 'binary',
        });
        return data;
    }
    async decryptArmoredAndVerify(armoredData, decryptionKeys, verificationKeys) {
        const { data, verified, verificationStatus, verificationErrors } = await this.cryptoProxy.decryptMessage({
            armoredMessage: armoredData,
            decryptionKeys,
            verificationKeys,
            format: 'binary',
        });
        return {
            data: data,
            // pmcrypto 8.3.0 changes `verified` to `verificationStatus`.
            // Proper typing is too complex, it will be removed to support only newer pmcrypto.
            verified: verified || verificationStatus,
            verificationErrors,
        };
    }
    async decryptArmoredAndVerifyDetached(armoredData, armoredSignature, sessionKey, verificationKeys) {
        const { data, verified, verificationStatus, verificationErrors } = await this.cryptoProxy.decryptMessage({
            armoredMessage: armoredData,
            armoredSignature,
            sessionKeys: sessionKey,
            verificationKeys,
            format: 'binary',
        });
        return {
            data: data,
            // pmcrypto 8.3.0 changes `verified` to `verificationStatus`.
            // Proper typing is too complex, it will be removed to support only newer pmcrypto.
            verified: verified || verificationStatus,
            verificationErrors: !armoredSignature
                ? [new Error((0, ttag_1.c)('Error').t `Signature is missing`)]
                : verificationErrors,
        };
    }
    async decryptArmoredWithPassword(armoredData, password) {
        const { data } = await this.cryptoProxy.decryptMessage({
            armoredMessage: armoredData,
            passwords: [password],
            format: 'binary',
        });
        return data;
    }
}
exports.OpenPGPCryptoWithCryptoProxy = OpenPGPCryptoWithCryptoProxy;
//# sourceMappingURL=openPGPCrypto.js.map