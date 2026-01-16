"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharingPublicCryptoReporter = void 0;
const ttag_1 = require("ttag");
const crypto_1 = require("../../crypto");
const errors_1 = require("../errors");
const interface_1 = require("../../interface");
class SharingPublicCryptoReporter {
    logger;
    telemetry;
    constructor(telemetry) {
        this.telemetry = telemetry;
        this.logger = telemetry.getLogger('sharingPublic-crypto');
    }
    async handleClaimedAuthor(node, field, signatureType, verified, verificationErrors, claimedAuthor, notAvailableVerificationKeys = false) {
        if (verified === crypto_1.VERIFICATION_STATUS.SIGNED_AND_VALID) {
            return (0, interface_1.resultOk)(claimedAuthor || null);
        }
        return (0, interface_1.resultError)({
            claimedAuthor,
            error: !claimedAuthor
                ? (0, ttag_1.c)('Info').t `Author is not provided on public link`
                : (0, errors_1.getVerificationMessage)(verified, verificationErrors, signatureType, notAvailableVerificationKeys),
        });
    }
    reportDecryptionError(node, field, error) {
        if ((0, errors_1.isNotApplicationError)(error)) {
            return;
        }
        const fromBefore2024 = node.creationTime < new Date('2024-01-01');
        this.logger.error(`Failed to decrypt public link node ${node.uid} (from before 2024: ${fromBefore2024})`, error);
        this.telemetry.recordMetric({
            eventName: 'decryptionError',
            volumeType: interface_1.MetricVolumeType.SharedPublic,
            field,
            fromBefore2024,
            error,
            uid: node.uid,
        });
    }
    reportVerificationError() {
        // Authors or signatures are not provided on public links.
        // We do not report any signature verification errors at this moment.
    }
}
exports.SharingPublicCryptoReporter = SharingPublicCryptoReporter;
//# sourceMappingURL=cryptoReporter.js.map