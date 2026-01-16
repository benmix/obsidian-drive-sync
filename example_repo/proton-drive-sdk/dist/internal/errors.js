"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createErrorFromUnknown = createErrorFromUnknown;
exports.getErrorMessage = getErrorMessage;
exports.getVerificationMessage = getVerificationMessage;
exports.isNotApplicationError = isNotApplicationError;
const ttag_1 = require("ttag");
const crypto_1 = require("../crypto");
const errors_1 = require("../errors");
function createErrorFromUnknown(error) {
    return error instanceof Error ? error : new Error(getErrorMessage(error), { cause: error });
}
function getErrorMessage(error) {
    return error instanceof Error ? error.message : (0, ttag_1.c)('Error').t `Unknown error`;
}
/**
 * @param signatureType - Must be translated before calling this function.
 */
function getVerificationMessage(verified, verificationErrors, signatureType, notAvailableVerificationKeys = false) {
    if (verified === crypto_1.VERIFICATION_STATUS.NOT_SIGNED) {
        return signatureType ? (0, ttag_1.c)('Error').t `Missing signature for ${signatureType}` : (0, ttag_1.c)('Error').t `Missing signature`;
    }
    if (notAvailableVerificationKeys) {
        return signatureType
            ? (0, ttag_1.c)('Error').t `Verification keys for ${signatureType} are not available`
            : (0, ttag_1.c)('Error').t `Verification keys are not available`;
    }
    if (verificationErrors) {
        const errorMessage = verificationErrors?.map((e) => e.message).join(', ');
        return signatureType
            ? (0, ttag_1.c)('Error').t `Signature verification for ${signatureType} failed: ${errorMessage}`
            : (0, ttag_1.c)('Error').t `Signature verification failed: ${errorMessage}`;
    }
    return signatureType
        ? (0, ttag_1.c)('Error').t `Signature verification for ${signatureType} failed`
        : (0, ttag_1.c)('Error').t `Signature verification failed`;
}
/**
 * Returns true if the error is not an application error (it is for example
 * a network error failing to fetch keys) and can be ignored for telemetry.
 */
function isNotApplicationError(error) {
    // SDK errors.
    if (error instanceof errors_1.AbortError ||
        error instanceof errors_1.ValidationError ||
        error instanceof errors_1.RateLimitedError ||
        error instanceof errors_1.ConnectionError) {
        return true;
    }
    // General errors that can come from the SDK dependencies (notably Account
    // dependency which loads the keys for the crypto services).
    if (error instanceof Error) {
        if (error.name === 'AbortError' || error.name === 'OfflineError' || error.name === 'TimeoutError') {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=errors.js.map