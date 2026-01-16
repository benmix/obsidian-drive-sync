export interface UnderlyingSeekableSource extends UnderlyingDefaultSource<Uint8Array> {
    seek: (position: number) => void | Promise<void>;
}
/**
 * A seekable readable stream that can be used to seek to a specific position
 * in the stream.
 *
 * This is useful for downloading the file in chunks or jumping to a specific
 * position in the file when streaming a video.
 *
 * Example to get next chunk of data from the stream at position 100:
 *
 * ```
 * const stream = new SeekableReadableStream(underlyingSource);
 * const reader = stream.getReader();
 * await stream.seek(100);
 * const data = await stream.read();
 * console.log(data);
 * ```
 */
export declare class SeekableReadableStream extends ReadableStream<Uint8Array> {
    private seekCallback;
    constructor({ seek, ...underlyingSource }: UnderlyingSeekableSource, queuingStrategy?: QueuingStrategy<Uint8Array>);
    seek(position: number): void | Promise<void>;
}
/**
 * A buffered seekable stream that allows to seek and read specific number of
 * bytes from the stream.
 *
 * This is useful for reading specific range of data from the stream. Example
 * being video player buffering the next several bytes.
 *
 * The underlying source can chunk the data into various sizes. To ensure that
 * every read operation is for the correct location, the SeekableStream is not
 * queueing the data upfront. Instead, it will read the data and buffer it for
 * the next read operation. If seek is called, the internal buffer is updated
 * accordingly.
 *
 * Example to read 10 bytes from the stream at position 100:
 *
 * ```
 * const stream = new BufferedSeekableStream(underlyingSource);
 * await stream.seek(100);
 * const data = await stream.read(10);
 * console.log(data);
 * ```
 */
export declare class BufferedSeekableStream extends SeekableReadableStream {
    private buffer;
    private bufferPosition;
    private reader;
    private streamClosed;
    private currentPosition;
    constructor(underlyingSource: UnderlyingSeekableSource, queuingStrategy?: QueuingStrategy<Uint8Array>);
    /**
     * Read a specific number of bytes from the stream.
     *
     * When the underlying source provides more bytes than requested, the
     * remaining bytes are buffered and used for the next read operation.
     *
     * @param numBytes - Number of bytes to read
     * @returns Promise<Uint8Array> The read bytes
     */
    read(numBytes: number): Promise<{
        value: Uint8Array;
        done: boolean;
    }>;
    private ensureBufferSize;
    /**
     * Seek to the given position in the stream.
     *
     * If the position is outside of internally buffered data, the buffer is
     * cleared. If the position is seeked back, the buffer is read again from
     * the underlying source.
     *
     * @param position - The position to seek to in bytes.
     */
    seek(position: number): Promise<void>;
}
