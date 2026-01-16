import { DriveCrypto } from '../../crypto';
import { ProtonDriveTelemetry, UploadMetadata, Thumbnail, AnonymousUser } from '../../interface';
import { DriveAPIService } from '../apiService';
import { UploadAPIService } from '../upload/apiService';
import { BlockVerifier } from '../upload/blockVerifier';
import { UploadController } from '../upload/controller';
import { UploadCryptoService } from '../upload/cryptoService';
import { FileUploader } from '../upload/fileUploader';
import { NodeRevisionDraft, NodesService } from '../upload/interface';
import { UploadManager } from '../upload/manager';
import { StreamUploader } from '../upload/streamUploader';
import { UploadTelemetry } from '../upload/telemetry';
export type PhotoUploadMetadata = UploadMetadata & {
    captureTime?: Date;
    mainPhotoLinkID?: string;
    tags?: (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)[];
};
export declare class PhotoFileUploader extends FileUploader {
    private photoApiService;
    private photoManager;
    private photoMetadata;
    constructor(telemetry: UploadTelemetry, apiService: PhotoUploadAPIService, cryptoService: UploadCryptoService, manager: PhotoUploadManager, parentFolderUid: string, name: string, metadata: PhotoUploadMetadata, onFinish: () => void, signal?: AbortSignal);
    protected newStreamUploader(blockVerifier: BlockVerifier, revisionDraft: NodeRevisionDraft, onFinish: (failure: boolean) => Promise<void>): Promise<StreamUploader>;
}
export declare class PhotoStreamUploader extends StreamUploader {
    private photoUploadManager;
    private photoMetadata;
    constructor(telemetry: UploadTelemetry, apiService: PhotoUploadAPIService, cryptoService: UploadCryptoService, uploadManager: PhotoUploadManager, blockVerifier: BlockVerifier, revisionDraft: NodeRevisionDraft, metadata: PhotoUploadMetadata, onFinish: (failure: boolean) => Promise<void>, controller: UploadController, signal?: AbortSignal);
    commitFile(thumbnails: Thumbnail[]): Promise<void>;
}
export declare class PhotoUploadManager extends UploadManager {
    private photoApiService;
    private photoCryptoService;
    constructor(telemetry: ProtonDriveTelemetry, apiService: PhotoUploadAPIService, cryptoService: PhotoUploadCryptoService, nodesService: NodesService, clientUid: string | undefined);
    commitDraftPhoto(nodeRevisionDraft: NodeRevisionDraft, manifest: Uint8Array, extendedAttributes: {
        modificationTime?: Date;
        size: number;
        blockSizes: number[];
        digests: {
            sha1: string;
        };
    }, uploadMetadata: PhotoUploadMetadata): Promise<void>;
}
export declare class PhotoUploadCryptoService extends UploadCryptoService {
    constructor(driveCrypto: DriveCrypto, nodesService: NodesService);
    generateContentHash(sha1: string, parentHashKey: Uint8Array): Promise<string>;
}
export declare class PhotoUploadAPIService extends UploadAPIService {
    constructor(apiService: DriveAPIService, clientUid: string | undefined);
    commitDraftPhoto(draftNodeRevisionUid: string, options: {
        armoredManifestSignature: string;
        signatureEmail: string | AnonymousUser;
        armoredExtendedAttributes?: string;
    }, photo: {
        contentHash: string;
        captureTime?: Date;
        mainPhotoLinkID?: string;
        tags?: (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)[];
    }): Promise<void>;
}
