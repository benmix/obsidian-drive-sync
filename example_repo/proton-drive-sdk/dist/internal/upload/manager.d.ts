import { Logger, ProtonDriveTelemetry, UploadMetadata } from '../../interface';
import { UploadAPIService } from './apiService';
import { UploadCryptoService } from './cryptoService';
import { NodeRevisionDraft, NodesService } from './interface';
/**
 * UploadManager is responsible for creating and deleting draft nodes
 * on the server. It handles the creation of draft nodes, including
 * generating the necessary cryptographic keys and metadata.
 */
export declare class UploadManager {
    protected apiService: UploadAPIService;
    protected cryptoService: UploadCryptoService;
    protected nodesService: NodesService;
    protected clientUid: string | undefined;
    protected logger: Logger;
    constructor(telemetry: ProtonDriveTelemetry, apiService: UploadAPIService, cryptoService: UploadCryptoService, nodesService: NodesService, clientUid: string | undefined);
    createDraftNode(parentFolderUid: string, name: string, metadata: UploadMetadata): Promise<NodeRevisionDraft>;
    private createDraftOnAPI;
    deleteDraftNode(nodeUid: string): Promise<void>;
    createDraftRevision(nodeUid: string, metadata: UploadMetadata): Promise<NodeRevisionDraft>;
    deleteDraftRevision(nodeRevisionUid: string): Promise<void>;
    commitDraft(nodeRevisionDraft: NodeRevisionDraft, manifest: Uint8Array, extendedAttributes: {
        modificationTime?: Date;
        size: number;
        blockSizes: number[];
        digests: {
            sha1: string;
        };
    }, additionalExtendedAttributes?: object): Promise<void>;
    protected notifyNodeUploaded(nodeRevisionDraft: NodeRevisionDraft): Promise<void>;
}
