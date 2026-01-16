"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodesCryptoReporter = void 0;
const crypto_1 = require("../../crypto");
const interface_1 = require("../../interface");
const errors_1 = require("../errors");
const uids_1 = require("../uids");
class NodesCryptoReporter {
    telemetry;
    shareService;
    logger;
    reportedDecryptionErrors = new Set();
    reportedVerificationErrors = new Set();
    constructor(telemetry, shareService) {
        this.telemetry = telemetry;
        this.shareService = shareService;
        this.telemetry = telemetry;
        this.logger = telemetry.getLogger('nodes-crypto');
        this.shareService = shareService;
    }
    async handleClaimedAuthor(node, field, signatureType, verified, verificationErrors, claimedAuthor, notAvailableVerificationKeys = false) {
        const author = handleClaimedAuthor(signatureType, verified, verificationErrors, claimedAuthor, notAvailableVerificationKeys);
        if (!author.ok) {
            void this.reportVerificationError(node, field, verificationErrors, claimedAuthor);
        }
        return author;
    }
    async reportVerificationError(node, field, verificationErrors, claimedAuthor) {
        if (this.reportedVerificationErrors.has(node.uid)) {
            return;
        }
        this.reportedVerificationErrors.add(node.uid);
        const fromBefore2024 = node.creationTime < new Date('2024-01-01');
        let addressMatchingDefaultShare, volumeType;
        try {
            const { volumeId } = (0, uids_1.splitNodeUid)(node.uid);
            const { email } = await this.shareService.getMyFilesShareMemberEmailKey();
            addressMatchingDefaultShare = claimedAuthor ? claimedAuthor === email : undefined;
            volumeType = await this.shareService.getVolumeMetricContext(volumeId);
        }
        catch (error) {
            this.logger.error('Failed to check if claimed author matches default share', error);
        }
        this.logger.warn(`Failed to verify ${field} for node ${node.uid} (from before 2024: ${fromBefore2024}, matching address: ${addressMatchingDefaultShare})`);
        this.telemetry.recordMetric({
            eventName: 'verificationError',
            volumeType,
            field,
            addressMatchingDefaultShare,
            fromBefore2024,
            error: verificationErrors?.map((e) => e.message).join(', '),
            uid: node.uid,
        });
    }
    async reportDecryptionError(node, field, error) {
        if ((0, errors_1.isNotApplicationError)(error)) {
            return;
        }
        if (this.reportedDecryptionErrors.has(node.uid)) {
            return;
        }
        const fromBefore2024 = node.creationTime < new Date('2024-01-01');
        let volumeType;
        try {
            const { volumeId } = (0, uids_1.splitNodeUid)(node.uid);
            volumeType = await this.shareService.getVolumeMetricContext(volumeId);
        }
        catch (error) {
            this.logger.error('Failed to get metric context', error);
        }
        this.logger.error(`Failed to decrypt node ${node.uid} (from before 2024: ${fromBefore2024})`, error);
        this.telemetry.recordMetric({
            eventName: 'decryptionError',
            volumeType,
            field,
            fromBefore2024,
            error,
            uid: node.uid,
        });
        this.reportedDecryptionErrors.add(node.uid);
    }
}
exports.NodesCryptoReporter = NodesCryptoReporter;
/**
 * @param signatureType - Must be translated before calling this function.
 */
function handleClaimedAuthor(signatureType, verified, verificationErrors, claimedAuthor, notAvailableVerificationKeys = false) {
    if (!claimedAuthor && notAvailableVerificationKeys) {
        return (0, interface_1.resultOk)(null);
    }
    if (verified === crypto_1.VERIFICATION_STATUS.SIGNED_AND_VALID) {
        return (0, interface_1.resultOk)(claimedAuthor || null);
    }
    return (0, interface_1.resultError)({
        claimedAuthor,
        error: (0, errors_1.getVerificationMessage)(verified, verificationErrors, signatureType, notAvailableVerificationKeys),
    });
}
//# sourceMappingURL=cryptoReporter.js.map