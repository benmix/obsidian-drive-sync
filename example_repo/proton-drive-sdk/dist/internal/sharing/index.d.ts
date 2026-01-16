import { ProtonDriveAccount, ProtonDriveEntitiesCache, ProtonDriveTelemetry } from '../../interface';
import { DriveCrypto } from '../../crypto';
import { DriveAPIService } from '../apiService';
import { ShareTargetType } from '../shares';
import { SharingAccess } from './sharingAccess';
import { SharingManagement } from './sharingManagement';
import { SharesService, NodesService } from './interface';
import { SharingEventHandler } from './events';
/**
 * Provides facade for the whole sharing module.
 *
 * The sharing module is responsible for handling invitations, bookmarks,
 * standard shares, listing shared nodes, etc. It includes API communication,
 * encryption, decryption, caching, and event handling.
 */
export declare function initSharingModule(telemetry: ProtonDriveTelemetry, apiService: DriveAPIService, driveEntitiesCache: ProtonDriveEntitiesCache, account: ProtonDriveAccount, crypto: DriveCrypto, sharesService: SharesService, nodesService: NodesService, shareTargetTypes?: ShareTargetType[]): {
    access: SharingAccess;
    eventHandler: SharingEventHandler;
    management: SharingManagement;
};
