import { Thumbnail, Logger, ThumbnailType, UploadMetadata } from '../../interface';
import { UploadAPIService } from './apiService';
import { BlockVerifier } from './blockVerifier';
import { UploadController } from './controller';
import { UploadCryptoService } from './cryptoService';
import { UploadDigests } from './digests';
import { NodeRevisionDraft, EncryptedBlock, EncryptedThumbnail, EncryptedBlockMetadata } from './interface';
import { UploadTelemetry } from './telemetry';
import { UploadManager } from './manager';
/**
 * File chunk size in bytes representing the size of each block.
 */
export declare const FILE_CHUNK_SIZE: number;
/**
 * StreamUploader is responsible for uploading file content to the server.
 *
 * It handles the encryption of file blocks and thumbnails, as well as
 * the upload process itself. It manages the upload queue and ensures
 * that the upload process is efficient and does not overload the server.
 */
export declare class StreamUploader {
    protected telemetry: UploadTelemetry;
    protected apiService: UploadAPIService;
    protected cryptoService: UploadCryptoService;
    protected uploadManager: UploadManager;
    protected blockVerifier: BlockVerifier;
    protected revisionDraft: NodeRevisionDraft;
    protected metadata: UploadMetadata;
    protected onFinish: (failure: boolean) => Promise<void>;
    protected uploadController: UploadController;
    protected abortController: AbortController;
    protected maxUploadingBlocks: number;
    protected logger: Logger;
    protected digests: UploadDigests;
    protected controller: UploadController;
    protected encryptedThumbnails: Map<ThumbnailType, EncryptedThumbnail>;
    protected encryptedBlocks: Map<number, EncryptedBlock>;
    protected encryptionFinished: boolean;
    protected ongoingUploads: Map<string, {
        index?: number;
        uploadPromise: Promise<void>;
        encryptedBlock: EncryptedBlock | EncryptedThumbnail;
    }>;
    protected uploadedThumbnails: ({
        type: ThumbnailType;
    } & EncryptedBlockMetadata)[];
    protected uploadedBlocks: ({
        index: number;
    } & EncryptedBlockMetadata)[];
    protected error: unknown | undefined;
    constructor(telemetry: UploadTelemetry, apiService: UploadAPIService, cryptoService: UploadCryptoService, uploadManager: UploadManager, blockVerifier: BlockVerifier, revisionDraft: NodeRevisionDraft, metadata: UploadMetadata, onFinish: (failure: boolean) => Promise<void>, uploadController: UploadController, abortController: AbortController);
    start(stream: ReadableStream, thumbnails: Thumbnail[], onProgress?: (uploadedBytes: number) => void): Promise<{
        nodeRevisionUid: string;
        nodeUid: string;
    }>;
    private encryptAndUploadBlocks;
    protected commitFile(thumbnails: Thumbnail[]): Promise<void>;
    private encryptThumbnails;
    private encryptBlocks;
    private requestAndInitiateUpload;
    private uploadThumbnail;
    private uploadBlock;
    private limitUploadCapacity;
    private waitForBufferCapacity;
    private waitForUploadCapacityAndBufferedBlocks;
    protected verifyIntegrity(thumbnails: Thumbnail[]): void;
    /**
     * Check if the encryption is fully finished.
     * This means that all blocks and thumbnails have been encrypted and
     * requested to be uploaded, and there are no more blocks or thumbnails
     * to encrypt and upload.
     */
    private get isEncryptionFullyFinished();
    private get uploadedBlockCount();
    private get uploadedOriginalFileSize();
    protected get uploadedBlockSizes(): number[];
    protected get manifest(): Uint8Array;
    private abortUpload;
    private get isUploadAborted();
}
