"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DownloadCryptoService = void 0;
const ttag_1 = require("ttag");
const crypto_1 = require("../../crypto");
const errors_1 = require("../../errors");
const errors_2 = require("../errors");
const utils_1 = require("../utils");
const interface_1 = require("./interface");
class DownloadCryptoService {
    driveCrypto;
    account;
    constructor(driveCrypto, account) {
        this.driveCrypto = driveCrypto;
        this.account = account;
        this.account = account;
        this.driveCrypto = driveCrypto;
    }
    async getRevisionKeys(nodeKey, revision) {
        const verificationKeys = await this.getRevisionVerificationKeys(revision, nodeKey.key);
        return {
            ...nodeKey,
            verificationKeys,
        };
    }
    async decryptBlock(encryptedBlock, revisionKeys) {
        let decryptedBlock;
        try {
            // We do not verify signatures on blocks. We only verify
            // the signature on the revision content key packet and
            // the manifest of the revision.
            // We plan to drop signatures of individual blocks
            // completely in the future. Any issue on the blocks
            // should be considered serious integrity issue.
            decryptedBlock = await this.driveCrypto.decryptBlock(encryptedBlock, revisionKeys.contentKeyPacketSessionKey);
        }
        catch (error) {
            const message = (0, errors_2.getErrorMessage)(error);
            throw new errors_1.DecryptionError((0, ttag_1.c)('Error').t `Failed to decrypt block: ${message}`, { cause: error });
        }
        return decryptedBlock;
    }
    async decryptThumbnail(thumbnail, contentKeyPacketSessionKey) {
        let decryptedBlock;
        try {
            const result = await this.driveCrypto.decryptThumbnailBlock(thumbnail, contentKeyPacketSessionKey, []);
            decryptedBlock = result.decryptedThumbnail;
        }
        catch (error) {
            const message = (0, errors_2.getErrorMessage)(error);
            throw new errors_1.DecryptionError((0, ttag_1.c)('Error').t `Failed to decrypt thumbnail: ${message}`, { cause: error });
        }
        return decryptedBlock;
    }
    async verifyBlockIntegrity(encryptedBlock, base64sha256Hash) {
        const digest = await crypto.subtle.digest('SHA-256', encryptedBlock);
        const expectedHash = (0, crypto_1.uint8ArrayToBase64String)(new Uint8Array(digest));
        if (expectedHash !== base64sha256Hash) {
            throw new errors_1.IntegrityError((0, ttag_1.c)('Error').t `Data integrity check of one part failed`, {
                expectedHash,
                actualHash: base64sha256Hash,
            });
        }
    }
    async verifyManifest(revision, nodeKey, allBlockHashes, armoredManifestSignature) {
        const hash = (0, utils_1.mergeUint8Arrays)(allBlockHashes);
        if (!armoredManifestSignature) {
            throw new errors_1.IntegrityError((0, ttag_1.c)('Error').t `Missing integrity signature`);
        }
        let verificationKeys;
        try {
            verificationKeys = await this.getRevisionVerificationKeys(revision, nodeKey);
        }
        catch (error) {
            throw new interface_1.SignatureVerificationError((0, ttag_1.c)('Error').t `Failed to get verification keys`, { revisionUid: revision.uid, contentAuthor: revision.contentAuthor }, { cause: error });
        }
        const { verified, verificationErrors } = await this.driveCrypto.verifyManifest(hash, armoredManifestSignature, verificationKeys);
        if (verified !== crypto_1.VERIFICATION_STATUS.SIGNED_AND_VALID) {
            throw new interface_1.SignatureVerificationError((0, ttag_1.c)('Error').t `Data integrity check failed`, {
                verificationErrors,
            });
        }
    }
    async getRevisionVerificationKeys(revision, nodeKey) {
        const signatureEmail = revision.contentAuthor.ok
            ? revision.contentAuthor.value
            : revision.contentAuthor.error.claimedAuthor;
        return signatureEmail ? await this.account.getPublicKeys(signatureEmail) : [nodeKey];
    }
}
exports.DownloadCryptoService = DownloadCryptoService;
//# sourceMappingURL=cryptoService.js.map