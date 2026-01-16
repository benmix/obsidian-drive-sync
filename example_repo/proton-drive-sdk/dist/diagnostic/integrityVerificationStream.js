"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrityVerificationStream = void 0;
const legacy_1 = require("@noble/hashes/legacy");
const utils_1 = require("@noble/hashes/utils");
/**
 * A WritableStream that computes SHA1 hash on the fly.
 * The computed SHA1 hash is available after the stream is closed.
 */
class IntegrityVerificationStream extends WritableStream {
    sha1Hash = legacy_1.sha1.create();
    _computedSha1 = undefined;
    _computedSizeInBytes = 0;
    _isClosed = false;
    constructor() {
        super({
            start: () => { },
            write: (chunk) => {
                if (this._isClosed) {
                    throw new Error('Cannot write to a closed stream');
                }
                this.sha1Hash.update(chunk);
                this._computedSizeInBytes += chunk.length;
            },
            close: () => {
                if (!this._isClosed) {
                    this._computedSha1 = (0, utils_1.bytesToHex)(this.sha1Hash.digest());
                    this._isClosed = true;
                }
            },
            abort: () => {
                this._isClosed = true;
                this._computedSha1 = undefined;
            },
        });
    }
    /**
     * Get the computed SHA1 hash. Only available after the stream is closed.
     * @returns The SHA1 hash as a hex string, or null if not yet computed or stream was aborted
     */
    get computedSha1() {
        return this._computedSha1;
    }
    /**
     * Get the computed size in bytes. Only available after the stream is closed.
     * @returns The size in bytes, or 0 if not yet computed or stream was aborted
     */
    get computedSizeInBytes() {
        if (!this._isClosed) {
            return undefined;
        }
        return this._computedSizeInBytes;
    }
}
exports.IntegrityVerificationStream = IntegrityVerificationStream;
//# sourceMappingURL=integrityVerificationStream.js.map