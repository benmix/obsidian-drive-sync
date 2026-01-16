import { DriveAPIService } from '../apiService';
import { BlockMetadata } from './interface';
export declare class DownloadAPIService {
    private apiService;
    constructor(apiService: DriveAPIService);
    iterateRevisionBlocks(nodeRevisionUid: string, signal?: AbortSignal, fromBlockIndex?: number): AsyncGenerator<{
        type: 'manifestSignature';
        armoredManifestSignature?: string;
    } | {
        type: 'thumbnail';
        base64sha256Hash: string;
    } | ({
        type: 'block';
    } & BlockMetadata)>;
    getRevisionBlockToken(nodeRevisionUid: string, blockIndex: number, signal?: AbortSignal): Promise<BlockMetadata>;
    downloadBlock(baseUrl: string, token: string, onProgress?: (downloadedBytes: number) => void, signal?: AbortSignal): Promise<Uint8Array>;
    iterateThumbnails(thumbnailUids: string[], signal?: AbortSignal): AsyncGenerator<{
        uid: string;
        ok: true;
        bareUrl: string;
        token: string;
    } | {
        uid: string;
        ok: false;
        error: string;
    }>;
}
