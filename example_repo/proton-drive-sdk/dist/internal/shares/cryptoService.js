"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharesCryptoService = void 0;
const interface_1 = require("../../interface");
const crypto_1 = require("../../crypto");
const errors_1 = require("../errors");
const interface_2 = require("./interface");
/**
 * Provides crypto operations for share keys.
 *
 * The share crypto service is responsible for encrypting and decrypting share
 * keys. It should export high-level actions only, such as "decrypt share"
 * instead of low-level operations like "decrypt share passphrase". Low-level
 * operations should be kept private to the module.
 *
 * The service owns the logic to switch between old and new crypto model.
 */
class SharesCryptoService {
    telemetry;
    driveCrypto;
    account;
    logger;
    reportedDecryptionErrors = new Set();
    reportedVerificationErrors = new Set();
    constructor(telemetry, driveCrypto, account) {
        this.telemetry = telemetry;
        this.driveCrypto = driveCrypto;
        this.account = account;
        this.telemetry = telemetry;
        this.logger = telemetry.getLogger('shares-crypto');
        this.driveCrypto = driveCrypto;
        this.account = account;
    }
    async generateVolumeBootstrap(addressKey) {
        const shareKey = await this.driveCrypto.generateKey([addressKey], addressKey);
        const rootNodeKey = await this.driveCrypto.generateKey([shareKey.decrypted.key], addressKey);
        const { armoredNodeName } = await this.driveCrypto.encryptNodeName('root', undefined, shareKey.decrypted.key, addressKey);
        const { armoredHashKey } = await this.driveCrypto.generateHashKey(rootNodeKey.decrypted.key);
        return {
            shareKey,
            rootNode: {
                key: rootNodeKey,
                encryptedName: armoredNodeName,
                armoredHashKey,
            },
        };
    }
    async decryptRootShare(share) {
        const { keys: addressKeys } = await this.account.getOwnAddress(share.addressId);
        const addressPublicKeys = await this.account.getPublicKeys(share.creatorEmail);
        let key, passphraseSessionKey, verified, verificationErrors;
        try {
            const result = await this.driveCrypto.decryptKey(share.encryptedCrypto.armoredKey, share.encryptedCrypto.armoredPassphrase, share.encryptedCrypto.armoredPassphraseSignature, addressKeys.map(({ key }) => key), addressPublicKeys);
            key = result.key;
            passphraseSessionKey = result.passphraseSessionKey;
            verified = result.verified;
            verificationErrors = result.verificationErrors;
        }
        catch (error) {
            this.reportDecryptionError(share, error);
            throw error;
        }
        const author = verified === crypto_1.VERIFICATION_STATUS.SIGNED_AND_VALID
            ? (0, interface_1.resultOk)(share.creatorEmail)
            : (0, interface_1.resultError)({
                claimedAuthor: share.creatorEmail,
                error: (0, errors_1.getVerificationMessage)(verified, verificationErrors),
            });
        if (!author.ok) {
            await this.reportVerificationError(share);
        }
        return {
            share: {
                ...share,
                author,
            },
            key: {
                key,
                passphraseSessionKey,
            },
        };
    }
    reportDecryptionError(share, error) {
        if ((0, errors_1.isNotApplicationError)(error)) {
            return;
        }
        if (this.reportedDecryptionErrors.has(share.shareId)) {
            return;
        }
        const fromBefore2024 = share.creationTime ? share.creationTime < new Date('2024-01-01') : undefined;
        this.logger.error(`Failed to decrypt share ${share.shareId} (from before 2024: ${fromBefore2024})`, error);
        this.telemetry.recordMetric({
            eventName: 'decryptionError',
            volumeType: shareTypeToMetricContext(share.type),
            field: 'shareKey',
            fromBefore2024,
            error,
            uid: share.shareId,
        });
        this.reportedDecryptionErrors.add(share.shareId);
    }
    async reportVerificationError(share) {
        if (this.reportedVerificationErrors.has(share.shareId)) {
            return;
        }
        const fromBefore2024 = share.creationTime ? share.creationTime < new Date('2024-01-01') : undefined;
        this.logger.error(`Failed to verify share ${share.shareId} (from before 2024: ${fromBefore2024})`);
        this.telemetry.recordMetric({
            eventName: 'verificationError',
            volumeType: shareTypeToMetricContext(share.type),
            field: 'shareKey',
            fromBefore2024,
            uid: share.shareId,
        });
        this.reportedVerificationErrors.add(share.shareId);
    }
}
exports.SharesCryptoService = SharesCryptoService;
function shareTypeToMetricContext(shareType) {
    // SDK doesn't support public sharing yet, also public sharing
    // doesn't use a share but shareURL, thus we can simplify and
    // ignore this case for now.
    switch (shareType) {
        case interface_2.ShareType.Main:
        case interface_2.ShareType.Device:
        case interface_2.ShareType.Photo:
            return interface_1.MetricVolumeType.OwnVolume;
        case interface_2.ShareType.Standard:
            return interface_1.MetricVolumeType.Shared;
    }
}
//# sourceMappingURL=cryptoService.js.map