export type HmacCryptoKey = CryptoKey;
type HmacKeyUsage = 'sign' | 'verify';
/**
 * Import an HMAC-SHA256 key in order to use it with `signData` and `verifyData`.
 */
export declare const importHmacKey: (key: Uint8Array, keyUsage?: HmacKeyUsage[]) => Promise<HmacCryptoKey>;
/**
 * Sign data using HMAC-SHA256
 * @param key - WebCrypto secret key for signing
 * @param data - data to sign
 * @param additionalData - additional data to authenticate
 */
export declare const computeHmacSignature: (key: HmacCryptoKey, data: Uint8Array) => Promise<Uint8Array>;
/**
 * Verify data using HMAC-SHA256
 * @param key - WebCrypto secret key for verification
 * @param signature - signature over data
 * @param data - data to verify
 * @param additionalData - additional data to authenticate
 */
export declare const verifyData: (key: HmacCryptoKey, signature: Uint8Array, data: Uint8Array) => Promise<boolean>;
export {};
