"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("../crypto");
const errors_1 = require("../errors");
const errors_2 = require("./errors");
describe('getVerificationMessage', () => {
    const testCases = [
        [crypto_1.VERIFICATION_STATUS.NOT_SIGNED, undefined, 'type', false, 'Missing signature for type'],
        [crypto_1.VERIFICATION_STATUS.NOT_SIGNED, undefined, undefined, false, 'Missing signature'],
        [crypto_1.VERIFICATION_STATUS.NOT_SIGNED, undefined, 'type', true, 'Missing signature for type'],
        [crypto_1.VERIFICATION_STATUS.NOT_SIGNED, undefined, undefined, true, 'Missing signature'],
        [crypto_1.VERIFICATION_STATUS.SIGNED_AND_INVALID, undefined, 'type', false, 'Signature verification for type failed'],
        [crypto_1.VERIFICATION_STATUS.SIGNED_AND_INVALID, undefined, undefined, false, 'Signature verification failed'],
        [
            crypto_1.VERIFICATION_STATUS.SIGNED_AND_INVALID,
            undefined,
            'type',
            true,
            'Verification keys for type are not available',
        ],
        [crypto_1.VERIFICATION_STATUS.SIGNED_AND_INVALID, undefined, undefined, true, 'Verification keys are not available'],
        [
            crypto_1.VERIFICATION_STATUS.SIGNED_AND_INVALID,
            [new Error('error1'), new Error('error2')],
            undefined,
            false,
            'Signature verification failed: error1, error2',
        ],
        [
            crypto_1.VERIFICATION_STATUS.SIGNED_AND_INVALID,
            [new Error('error1'), new Error('error2')],
            'type',
            false,
            'Signature verification for type failed: error1, error2',
        ],
        [
            crypto_1.VERIFICATION_STATUS.SIGNED_AND_INVALID,
            [new Error('error1'), new Error('error2')],
            undefined,
            true,
            'Verification keys are not available',
        ],
        [
            crypto_1.VERIFICATION_STATUS.SIGNED_AND_INVALID,
            [new Error('error1'), new Error('error2')],
            'type',
            true,
            'Verification keys for type are not available',
        ],
    ];
    for (const [status, errors, type, notAvailable, expected] of testCases) {
        it(`returns correct message for status ${status} with type ${type} and notAvailable ${notAvailable}`, () => {
            expect((0, errors_2.getVerificationMessage)(status, errors, type, notAvailable)).toBe(expected);
        });
    }
});
describe('isNotApplicationError', () => {
    describe('SDK errors that should be ignored', () => {
        it('returns true for AbortError', () => {
            const error = new errors_1.AbortError('Operation aborted');
            expect((0, errors_2.isNotApplicationError)(error)).toBe(true);
        });
        it('returns true for ValidationError', () => {
            const error = new errors_1.ValidationError('Validation failed');
            expect((0, errors_2.isNotApplicationError)(error)).toBe(true);
        });
        it('returns true for RateLimitedError', () => {
            const error = new errors_1.RateLimitedError('Rate limited');
            expect((0, errors_2.isNotApplicationError)(error)).toBe(true);
        });
        it('returns true for ConnectionError', () => {
            const error = new errors_1.ConnectionError('Connection failed');
            expect((0, errors_2.isNotApplicationError)(error)).toBe(true);
        });
    });
    describe('General errors with specific names that should be ignored', () => {
        it('returns true for Error with name AbortError', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            expect((0, errors_2.isNotApplicationError)(error)).toBe(true);
        });
        it('returns true for Error with name OfflineError', () => {
            const error = new Error('Offline');
            error.name = 'OfflineError';
            expect((0, errors_2.isNotApplicationError)(error)).toBe(true);
        });
        it('returns true for Error with name TimeoutError', () => {
            const error = new Error('Timeout');
            error.name = 'TimeoutError';
            expect((0, errors_2.isNotApplicationError)(error)).toBe(true);
        });
    });
    describe('Errors that should not be ignored', () => {
        it('returns false for regular Error', () => {
            const error = new Error('Regular error');
            expect((0, errors_2.isNotApplicationError)(error)).toBe(false);
        });
        it('returns false for undefined', () => {
            expect((0, errors_2.isNotApplicationError)(undefined)).toBe(false);
        });
        it('returns false for non-Error object', () => {
            const error = { message: 'Not an error' };
            expect((0, errors_2.isNotApplicationError)(error)).toBe(false);
        });
    });
});
//# sourceMappingURL=errors.test.js.map