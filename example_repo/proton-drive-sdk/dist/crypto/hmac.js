"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyData = exports.computeHmacSignature = exports.importHmacKey = void 0;
const HASH_ALGORITHM = 'SHA-256';
const KEY_LENGTH_BYTES = 32;
/**
 * Import an HMAC-SHA256 key in order to use it with `signData` and `verifyData`.
 */
const importHmacKey = async (key, keyUsage = ['sign', 'verify']) => {
    // From https://datatracker.ietf.org/doc/html/rfc2104:
    // The key for HMAC can be of any length (keys longer than B bytes are first hashed using H).
    // However, less than L bytes (L = 32 bytes for SHA-256) is strongly discouraged as it would
    // decrease the security strength of the function.  Keys longer than L bytes are acceptable
    // but the extra length would not significantly increase the function strength.
    // (A longer key may be advisable if the randomness of the key is considered weak.)
    if (key.length < KEY_LENGTH_BYTES) {
        throw new Error('Unexpected HMAC key size: key is too short');
    }
    return crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: HASH_ALGORITHM }, false, keyUsage);
};
exports.importHmacKey = importHmacKey;
/**
 * Sign data using HMAC-SHA256
 * @param key - WebCrypto secret key for signing
 * @param data - data to sign
 * @param additionalData - additional data to authenticate
 */
const computeHmacSignature = async (key, data) => {
    const signatureBuffer = await crypto.subtle.sign({ name: 'HMAC', hash: HASH_ALGORITHM }, key, data);
    return new Uint8Array(signatureBuffer);
};
exports.computeHmacSignature = computeHmacSignature;
/**
 * Verify data using HMAC-SHA256
 * @param key - WebCrypto secret key for verification
 * @param signature - signature over data
 * @param data - data to verify
 * @param additionalData - additional data to authenticate
 */
const verifyData = async (key, signature, data) => {
    return crypto.subtle.verify({ name: 'HMAC', hash: HASH_ALGORITHM }, key, signature, data);
};
exports.verifyData = verifyData;
//# sourceMappingURL=hmac.js.map