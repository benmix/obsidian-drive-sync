import { DriveAPIService } from '../apiService';
import { DriveCrypto } from '../../crypto';
import { ProtonDriveAccount, ProtonDriveCryptoCache, ProtonDriveEntitiesCache, ProtonDriveTelemetry } from '../../interface';
import { ShareTargetType } from '../shares';
import { NodesService as UploadNodesService } from '../upload/interface';
import { Albums } from './albums';
import { SharesService } from './interface';
import { PhotosNodesAccess, PhotosNodesManagement } from './nodes';
import { PhotoSharesManager } from './shares';
import { PhotosTimeline } from './timeline';
import { PhotoFileUploader, PhotoUploadMetadata } from './upload';
import { NodesRevisons } from '../nodes/nodesRevisions';
import { NodesEventsHandler } from '../nodes/events';
export type { DecryptedPhotoNode } from './interface';
export declare const PHOTOS_SHARE_TARGET_TYPES: ShareTargetType[];
/**
 * Provides facade for the whole photos module.
 *
 * The photos module is responsible for handling photos and albums metadata,
 * including API communication, crypto, caching, and event handling.
 */
export declare function initPhotosModule(telemetry: ProtonDriveTelemetry, apiService: DriveAPIService, driveCrypto: DriveCrypto, photoShares: PhotoSharesManager, nodesService: PhotosNodesAccess): {
    timeline: PhotosTimeline;
    albums: Albums;
};
/**
 * Provides facade for the photo share module.
 *
 * The photo share wraps the core share module, but uses photos volume instead
 * of main volume. It provides the same interface so it can be used in the same
 * way in various modules that use shares.
 */
export declare function initPhotoSharesModule(telemetry: ProtonDriveTelemetry, apiService: DriveAPIService, driveEntitiesCache: ProtonDriveEntitiesCache, driveCryptoCache: ProtonDriveCryptoCache, account: ProtonDriveAccount, crypto: DriveCrypto, sharesService: SharesService): PhotoSharesManager;
/**
 * Provides facade for the photo nodes module.
 *
 * The photo nodes module wraps the core nodes module and adds photo specific
 * metadata. It provides the same interface so it can be used in the same way.
 */
export declare function initPhotosNodesModule(telemetry: ProtonDriveTelemetry, apiService: DriveAPIService, driveEntitiesCache: ProtonDriveEntitiesCache, driveCryptoCache: ProtonDriveCryptoCache, account: ProtonDriveAccount, driveCrypto: DriveCrypto, sharesService: PhotoSharesManager, clientUid: string | undefined): {
    access: PhotosNodesAccess;
    management: PhotosNodesManagement;
    revisions: NodesRevisons;
    eventHandler: NodesEventsHandler;
};
/**
 * Provides facade for the photo upload module.
 *
 * The photo upload wraps the core upload module and adds photo specific metadata.
 * It provides the same interface so it can be used in the same way.
 */
export declare function initPhotoUploadModule(telemetry: ProtonDriveTelemetry, apiService: DriveAPIService, driveCrypto: DriveCrypto, sharesService: SharesService, nodesService: UploadNodesService, clientUid?: string): {
    getFileUploader: (parentFolderUid: string, name: string, metadata: PhotoUploadMetadata, signal?: AbortSignal) => Promise<PhotoFileUploader>;
};
