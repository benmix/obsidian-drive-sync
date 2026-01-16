"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignatureVerificationError = void 0;
const errors_1 = require("../../errors");
/**
 * Error thrown when the manifest signature verification fails.
 * This is a special case that is reported as download complete with signature
 * issues. The client must then ask the user to agree to save the file anyway
 * or abort and clean up the file.
 *
 * This error is not exposed to the client. It is only used internally to track
 * the signature verification issues. For the client it must be reported as
 * the IntegrityError.
 */
class SignatureVerificationError extends errors_1.IntegrityError {
    name = 'SignatureVerificationError';
}
exports.SignatureVerificationError = SignatureVerificationError;
//# sourceMappingURL=interface.js.map