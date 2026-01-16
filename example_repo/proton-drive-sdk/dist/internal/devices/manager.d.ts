import { Device, DeviceType, Logger } from '../../interface';
import { DevicesAPIService } from './apiService';
import { DevicesCryptoService } from './cryptoService';
import { NodesManagementService, NodesService, SharesService } from './interface';
export declare class DevicesManager {
    private logger;
    private apiService;
    private cryptoService;
    private sharesService;
    private nodesService;
    private nodesManagementService;
    constructor(logger: Logger, apiService: DevicesAPIService, cryptoService: DevicesCryptoService, sharesService: SharesService, nodesService: NodesService, nodesManagementService: NodesManagementService);
    iterateDevices(signal?: AbortSignal): AsyncGenerator<Device>;
    createDevice(name: string, deviceType: DeviceType): Promise<Device>;
    renameDevice(deviceUid: string, name: string): Promise<Device>;
    private getDeviceMetadata;
    deleteDevice(deviceUid: string): Promise<void>;
}
