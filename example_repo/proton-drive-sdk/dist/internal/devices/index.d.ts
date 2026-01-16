import { DriveCrypto } from '../../crypto';
import { ProtonDriveTelemetry } from '../../interface';
import { DriveAPIService } from '../apiService';
import { SharesService, NodesService, NodesManagementService } from './interface';
import { DevicesManager } from './manager';
/**
 * Provides facade for the whole devices module.
 *
 * The devices module is responsible for handling devices metadata, including
 * API communication, encryption, decryption, caching, and event handling.
 *
 * This facade provides internal interface that other modules can use to
 * interact with the devices.
 */
export declare function initDevicesModule(telemetry: ProtonDriveTelemetry, apiService: DriveAPIService, driveCrypto: DriveCrypto, sharesService: SharesService, nodesService: NodesService, nodesManagementService: NodesManagementService): DevicesManager;
