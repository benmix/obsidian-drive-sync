import { DriveCrypto, PrivateKey } from '../../crypto';
import { ProtonDriveCryptoCache, ProtonDriveTelemetry, ProtonDriveAccount, ProtonDriveEntitiesCache, MemberRole } from '../../interface';
import { DriveAPIService } from '../apiService';
import { NodesRevisons } from '../nodes/nodesRevisions';
import { SharingPublicNodesAccess, SharingPublicNodesManagement } from './nodes';
import { SharingPublicSharesManager } from './shares';
export { SharingPublicSessionManager } from './session/manager';
export { UnauthDriveAPIService } from './unauthApiService';
/**
 * Provides facade for the whole sharing public module.
 *
 * The sharing public module is responsible for handling public link data, including
 * API communication, encryption, decryption, and caching.
 *
 * This facade provides internal interface that other modules can use to
 * interact with the public links.
 */
export declare function initSharingPublicModule(telemetry: ProtonDriveTelemetry, apiService: DriveAPIService, driveEntitiesCache: ProtonDriveEntitiesCache, driveCryptoCache: ProtonDriveCryptoCache, driveCrypto: DriveCrypto, account: ProtonDriveAccount, url: string, token: string, publicShareKey: PrivateKey, publicRootNodeUid: string, publicRole: MemberRole, isAnonymousContext: boolean): {
    shares: SharingPublicSharesManager;
    nodes: {
        access: SharingPublicNodesAccess;
        management: SharingPublicNodesManagement;
        revisions: NodesRevisons;
    };
};
/**
 * Provides facade for the public link nodes module.
 *
 * The public link nodes initializes the core nodes module, but uses public
 * link shares or crypto reporter instead.
 */
export declare function initSharingPublicNodesModule(telemetry: ProtonDriveTelemetry, apiService: DriveAPIService, driveEntitiesCache: ProtonDriveEntitiesCache, driveCryptoCache: ProtonDriveCryptoCache, driveCrypto: DriveCrypto, account: ProtonDriveAccount, sharesService: SharingPublicSharesManager, url: string, token: string, publicShareKey: PrivateKey, publicRootNodeUid: string, publicRole: MemberRole, isAnonymousContext: boolean): {
    access: SharingPublicNodesAccess;
    management: SharingPublicNodesManagement;
    revisions: NodesRevisons;
};
