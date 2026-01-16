"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadCryptoService = void 0;
const ttag_1 = require("ttag");
const errors_1 = require("../../errors");
class UploadCryptoService {
    driveCrypto;
    nodesService;
    constructor(driveCrypto, nodesService) {
        this.driveCrypto = driveCrypto;
        this.nodesService = nodesService;
        this.driveCrypto = driveCrypto;
        this.nodesService = nodesService;
    }
    async generateFileCrypto(parentUid, parentKeys, name) {
        const signingKeys = await this.getSigningKeys({ parentNodeUid: parentUid });
        if (!signingKeys.nameAndPassphraseSigningKey) {
            throw new Error('Cannot create new node without a name and passphrase signing key');
        }
        const [nodeKeys, { armoredNodeName }, hash] = await Promise.all([
            this.driveCrypto.generateKey([parentKeys.key], signingKeys.nameAndPassphraseSigningKey),
            this.driveCrypto.encryptNodeName(name, undefined, parentKeys.key, signingKeys.nameAndPassphraseSigningKey),
            this.driveCrypto.generateLookupHash(name, parentKeys.hashKey),
        ]);
        const contentKey = await this.driveCrypto.generateContentKey(nodeKeys.decrypted.key);
        return {
            nodeKeys,
            contentKey,
            encryptedNode: {
                encryptedName: armoredNodeName,
                hash,
            },
            signingKeys: {
                email: signingKeys.email,
                addressId: signingKeys.addressId,
                nameAndPassphraseSigningKey: signingKeys.nameAndPassphraseSigningKey,
                contentSigningKey: signingKeys.contentSigningKey || nodeKeys.decrypted.key,
            },
        };
    }
    async getSigningKeysForExistingNode(uids) {
        const signingKeys = await this.getSigningKeys(uids);
        if (!signingKeys.nameAndPassphraseSigningKey) {
            throw new Error('Cannot get name and passphrase signing key for existing node');
        }
        if (!signingKeys.contentSigningKey) {
            throw new Error('Cannot get content signing key for existing node');
        }
        return {
            email: signingKeys.email,
            addressId: signingKeys.addressId,
            nameAndPassphraseSigningKey: signingKeys.nameAndPassphraseSigningKey,
            contentSigningKey: signingKeys.contentSigningKey,
        };
    }
    async getSigningKeys(uids) {
        const signingKeys = await this.nodesService.getNodeSigningKeys(uids);
        const email = signingKeys.type === 'userAddress' ? signingKeys.email : null;
        const addressId = signingKeys.type === 'userAddress' ? signingKeys.addressId : null;
        const nameAndPassphraseSigningKey = signingKeys.type === 'userAddress' ? signingKeys.key : signingKeys.parentNodeKey;
        const contentSigningKey = signingKeys.type === 'userAddress' ? signingKeys.key : signingKeys.nodeKey;
        return {
            email,
            addressId,
            nameAndPassphraseSigningKey,
            contentSigningKey,
        };
    }
    async encryptThumbnail(nodeRevisionDraftKeys, thumbnail) {
        const { encryptedData } = await this.driveCrypto.encryptThumbnailBlock(thumbnail.thumbnail, nodeRevisionDraftKeys.contentKeyPacketSessionKey, nodeRevisionDraftKeys.signingKeys.contentSigningKey);
        const digest = await crypto.subtle.digest('SHA-256', encryptedData);
        return {
            type: thumbnail.type,
            encryptedData: encryptedData,
            originalSize: thumbnail.thumbnail.length,
            encryptedSize: encryptedData.length,
            hash: new Uint8Array(digest),
        };
    }
    async encryptBlock(verifyBlock, nodeRevisionDraftKeys, block, index) {
        const { encryptedData, armoredSignature } = await this.driveCrypto.encryptBlock(block, nodeRevisionDraftKeys.key, nodeRevisionDraftKeys.contentKeyPacketSessionKey, nodeRevisionDraftKeys.signingKeys.contentSigningKey);
        const digest = await crypto.subtle.digest('SHA-256', encryptedData);
        const { verificationToken } = await verifyBlock(encryptedData);
        return {
            index,
            encryptedData,
            armoredSignature,
            verificationToken,
            originalSize: block.length,
            encryptedSize: encryptedData.length,
            hash: new Uint8Array(digest),
        };
    }
    async commitFile(nodeRevisionDraftKeys, manifest, extendedAttributes) {
        const { armoredManifestSignature } = await this.driveCrypto.signManifest(manifest, nodeRevisionDraftKeys.signingKeys.contentSigningKey);
        const { armoredExtendedAttributes } = extendedAttributes
            ? await this.driveCrypto.encryptExtendedAttributes(extendedAttributes, nodeRevisionDraftKeys.key, nodeRevisionDraftKeys.signingKeys.contentSigningKey)
            : { armoredExtendedAttributes: undefined };
        return {
            armoredManifestSignature,
            signatureEmail: nodeRevisionDraftKeys.signingKeys.email,
            armoredExtendedAttributes,
        };
    }
    async getContentKeyPacketSessionKey(nodeKey, base64ContentKeyPacket) {
        const { sessionKey } = await this.driveCrypto.decryptAndVerifySessionKey(base64ContentKeyPacket, undefined, nodeKey, []);
        return sessionKey;
    }
    async verifyBlock(contentKeyPacketSessionKey, verificationCode, encryptedData) {
        // Attempt to decrypt data block, to try to detect bitflips / bad hardware
        //
        // We don't check the signature as it is an expensive operation,
        // and we don't need to here as we always have the manifest signature
        //
        // Additionally, we use the key provided by the verification endpoint, to
        // ensure the correct key was used to encrypt the data
        try {
            await this.driveCrypto.decryptBlock(encryptedData, contentKeyPacketSessionKey);
        }
        catch (error) {
            throw new errors_1.IntegrityError((0, ttag_1.c)('Error').t `Data integrity check of one part failed`, {
                error,
            });
        }
        // The verifier requires a 0-padded data packet, so we can
        // access the array directly and fall back to 0.
        const verificationToken = verificationCode.map((value, index) => value ^ (encryptedData[index] || 0));
        return {
            verificationToken,
        };
    }
}
exports.UploadCryptoService = UploadCryptoService;
//# sourceMappingURL=cryptoService.js.map