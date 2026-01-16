/**
 * A WritableStream that computes SHA1 hash on the fly.
 * The computed SHA1 hash is available after the stream is closed.
 */
export declare class IntegrityVerificationStream extends WritableStream<Uint8Array> {
    private sha1Hash;
    private _computedSha1;
    private _computedSizeInBytes;
    private _isClosed;
    constructor();
    /**
     * Get the computed SHA1 hash. Only available after the stream is closed.
     * @returns The SHA1 hash as a hex string, or null if not yet computed or stream was aborted
     */
    get computedSha1(): string | undefined;
    /**
     * Get the computed size in bytes. Only available after the stream is closed.
     * @returns The size in bytes, or 0 if not yet computed or stream was aborted
     */
    get computedSizeInBytes(): number | undefined;
}
