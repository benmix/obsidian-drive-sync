import { DriveCrypto } from '../../crypto';
import { ProtonDriveAccount, ProtonDriveTelemetry, ThumbnailType, ThumbnailResult } from '../../interface';
import { DriveAPIService } from '../apiService';
import { NodesService, RevisionsService, SharesService } from './interface';
import { FileDownloader } from './fileDownloader';
export declare function initDownloadModule(telemetry: ProtonDriveTelemetry, apiService: DriveAPIService, driveCrypto: DriveCrypto, account: ProtonDriveAccount, sharesService: SharesService, nodesService: NodesService, revisionsService: RevisionsService, ignoreManifestVerification?: boolean): {
    getFileDownloader: (nodeUid: string, signal?: AbortSignal) => Promise<FileDownloader>;
    getFileRevisionDownloader: (nodeRevisionUid: string, signal?: AbortSignal) => Promise<FileDownloader>;
    iterateThumbnails: (nodeUids: string[], thumbnailType?: ThumbnailType, signal?: AbortSignal) => AsyncGenerator<ThumbnailResult>;
};
