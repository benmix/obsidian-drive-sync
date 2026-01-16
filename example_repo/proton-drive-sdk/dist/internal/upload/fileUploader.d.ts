import { Thumbnail, UploadMetadata } from '../../interface';
import { UploadAPIService } from './apiService';
import { BlockVerifier } from './blockVerifier';
import { UploadController } from './controller';
import { UploadCryptoService } from './cryptoService';
import { NodeRevisionDraft } from './interface';
import { UploadManager } from './manager';
import { StreamUploader } from './streamUploader';
import { UploadTelemetry } from './telemetry';
/**
 * Uploader is generic class responsible for creating a revision draft
 * and initiate the upload process for a file object or a stream.
 *
 * This class is not meant to be used directly, but rather to be extended
 * by `FileUploader` and `FileRevisionUploader`.
 */
declare abstract class Uploader {
    protected telemetry: UploadTelemetry;
    protected apiService: UploadAPIService;
    protected cryptoService: UploadCryptoService;
    protected manager: UploadManager;
    protected metadata: UploadMetadata;
    protected onFinish: () => void;
    protected signal?: AbortSignal | undefined;
    protected controller: UploadController;
    protected abortController: AbortController;
    constructor(telemetry: UploadTelemetry, apiService: UploadAPIService, cryptoService: UploadCryptoService, manager: UploadManager, metadata: UploadMetadata, onFinish: () => void, signal?: AbortSignal | undefined);
    uploadFromFile(fileObject: File, thumbnails: Thumbnail[], onProgress?: (uploadedBytes: number) => void): Promise<UploadController>;
    uploadFromStream(stream: ReadableStream, thumbnails: Thumbnail[], onProgress?: (uploadedBytes: number) => void): Promise<UploadController>;
    protected startUpload(stream: ReadableStream, thumbnails: Thumbnail[], onProgress?: (uploadedBytes: number) => void): Promise<{
        nodeRevisionUid: string;
        nodeUid: string;
    }>;
    protected initStreamUploader(): Promise<StreamUploader>;
    protected newStreamUploader(blockVerifier: BlockVerifier, revisionDraft: NodeRevisionDraft, onFinish: (failure: boolean) => Promise<void>): Promise<StreamUploader>;
    protected abstract createRevisionDraft(): Promise<{
        revisionDraft: NodeRevisionDraft;
        blockVerifier: BlockVerifier;
    }>;
    protected abstract deleteRevisionDraft(revisionDraft: NodeRevisionDraft): Promise<void>;
}
/**
 * Uploader implementation for a new file.
 */
export declare class FileUploader extends Uploader {
    private parentFolderUid;
    private name;
    constructor(telemetry: UploadTelemetry, apiService: UploadAPIService, cryptoService: UploadCryptoService, manager: UploadManager, parentFolderUid: string, name: string, metadata: UploadMetadata, onFinish: () => void, signal?: AbortSignal);
    protected createRevisionDraft(): Promise<{
        revisionDraft: NodeRevisionDraft;
        blockVerifier: BlockVerifier;
    }>;
    protected deleteRevisionDraft(revisionDraft: NodeRevisionDraft): Promise<void>;
}
/**
 * Uploader implementation for a new file revision.
 */
export declare class FileRevisionUploader extends Uploader {
    private nodeUid;
    constructor(telemetry: UploadTelemetry, apiService: UploadAPIService, cryptoService: UploadCryptoService, manager: UploadManager, nodeUid: string, metadata: UploadMetadata, onFinish: () => void, signal?: AbortSignal);
    protected createRevisionDraft(): Promise<{
        revisionDraft: NodeRevisionDraft;
        blockVerifier: BlockVerifier;
    }>;
    protected deleteRevisionDraft(revisionDraft: NodeRevisionDraft): Promise<void>;
}
export {};
