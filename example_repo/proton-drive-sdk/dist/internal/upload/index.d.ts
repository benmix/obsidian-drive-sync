import { ProtonDriveTelemetry, UploadMetadata } from '../../interface';
import { DriveAPIService } from '../apiService';
import { DriveCrypto } from '../../crypto';
import { FileUploader, FileRevisionUploader } from './fileUploader';
import { NodesService, SharesService } from './interface';
/**
 * Provides facade for the upload module.
 *
 * The upload module is responsible for handling file uploads, including
 * metadata generation, content upload, API communication, encryption,
 * and verifications.
 */
export declare function initUploadModule(telemetry: ProtonDriveTelemetry, apiService: DriveAPIService, driveCrypto: DriveCrypto, sharesService: SharesService, nodesService: NodesService, clientUid?: string): {
    getFileUploader: (parentFolderUid: string, name: string, metadata: UploadMetadata, signal?: AbortSignal) => Promise<FileUploader>;
    getFileRevisionUploader: (nodeUid: string, metadata: UploadMetadata, signal?: AbortSignal) => Promise<FileRevisionUploader>;
};
