import { DriveAPIService } from '../apiService';
import { DriveCrypto } from '../../crypto';
import { ProtonDriveEntitiesCache, ProtonDriveCryptoCache, ProtonDriveAccount, ProtonDriveTelemetry } from '../../interface';
import { SharesService } from './interface';
import { NodesAccess } from './nodesAccess';
import { NodesManagement } from './nodesManagement';
import { NodesRevisons } from './nodesRevisions';
import { NodesEventsHandler } from './events';
export type { DecryptedNode, DecryptedRevision } from './interface';
export { generateFileExtendedAttributes } from './extendedAttributes';
/**
 * Provides facade for the whole nodes module.
 *
 * The nodes module is responsible for handling node metadata, including
 * API communication, encryption, decryption, caching, and event handling.
 *
 * This facade provides internal interface that other modules can use to
 * interact with the nodes.
 */
export declare function initNodesModule(telemetry: ProtonDriveTelemetry, apiService: DriveAPIService, driveEntitiesCache: ProtonDriveEntitiesCache, driveCryptoCache: ProtonDriveCryptoCache, account: ProtonDriveAccount, driveCrypto: DriveCrypto, sharesService: SharesService, clientUid: string | undefined): {
    access: NodesAccess;
    management: NodesManagement;
    revisions: NodesRevisons;
    eventHandler: NodesEventsHandler;
};
