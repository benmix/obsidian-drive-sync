import { ProtonDriveEntitiesCache, ProtonDriveCryptoCache, ProtonDriveAccount, ProtonDriveTelemetry } from '../../interface';
import { DriveCrypto } from '../../crypto';
import { DriveAPIService } from '../apiService';
import { SharesManager } from './manager';
export { ShareTargetType } from './interface';
export type { EncryptedShare } from './interface';
/**
 * Provides facade for the whole shares module.
 *
 * The shares module is responsible for handling shares metadata, including
 * API communication, encryption, decryption, caching, and event handling.
 *
 * This facade provides internal interface that other modules can use to
 * interact with the shares.
 */
export declare function initSharesModule(telemetry: ProtonDriveTelemetry, apiService: DriveAPIService, driveEntitiesCache: ProtonDriveEntitiesCache, driveCryptoCache: ProtonDriveCryptoCache, account: ProtonDriveAccount, crypto: DriveCrypto): SharesManager;
