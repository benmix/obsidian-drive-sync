import { DeviceType } from '../../interface';
import { DriveAPIService } from '../apiService';
import { DeviceMetadata } from './interface';
/**
 * Provides API communication for managing devices.
 *
 * The service is responsible for transforming local objects to API payloads
 * and vice versa. It should not contain any business logic.
 */
export declare class DevicesAPIService {
    private apiService;
    constructor(apiService: DriveAPIService);
    getDevices(signal?: AbortSignal): Promise<DeviceMetadata[]>;
    /**
     * Originally the device name was on the share of the device.
     * This was changed to be on the root node of the device instead.
     * Old devices will still have the name on the share and when
     * the client renames the device, it must be removed on the device.
     */
    removeNameFromDevice(deviceUid: string): Promise<void>;
    createDevice(device: {
        volumeId: string;
        type: DeviceType;
    }, share: {
        addressId: string;
        addressKeyId: string;
        armoredKey: string;
        armoredSharePassphrase: string;
        armoredSharePassphraseSignature: string;
    }, node: {
        encryptedName: string;
        armoredKey: string;
        armoredNodePassphrase: string;
        armoredNodePassphraseSignature: string;
        armoredHashKey: string;
    }): Promise<DeviceMetadata>;
    deleteDevice(deviceUid: string): Promise<void>;
}
