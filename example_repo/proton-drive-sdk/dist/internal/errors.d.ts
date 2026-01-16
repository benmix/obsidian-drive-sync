import { VERIFICATION_STATUS } from '../crypto';
export declare function createErrorFromUnknown(error: unknown): Error;
export declare function getErrorMessage(error: unknown): string;
/**
 * @param signatureType - Must be translated before calling this function.
 */
export declare function getVerificationMessage(verified: VERIFICATION_STATUS, verificationErrors?: Error[], signatureType?: string, notAvailableVerificationKeys?: boolean): string;
/**
 * Returns true if the error is not an application error (it is for example
 * a network error failing to fetch keys) and can be ignored for telemetry.
 */
export declare function isNotApplicationError(error?: unknown): boolean;
