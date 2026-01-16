/**
 * This class is used to read a stream in chunks.
 *
 * WARNING: The chunks are reused to avoid allocating new memory for each chunk.
 * Ensure that the previous chunk is fully read before reading the next chunk.
 * If you need to keep previous chunks, copy them to a new array.
 */
export declare class ChunkStreamReader {
    private reader;
    private chunkSize;
    constructor(stream: ReadableStream<Uint8Array>, chunkSize: number);
    iterateChunks(): AsyncGenerator<Uint8Array>;
}
